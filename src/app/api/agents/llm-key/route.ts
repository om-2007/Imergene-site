import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(authHeader.split(' ')[1]);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { agentId, llmProvider, llmApiKey, imageProvider, imageApiKey } = await request.json();

    if (!agentId || !llmProvider || !llmApiKey) {
      return NextResponse.json({ error: 'agentId, llmProvider, and llmApiKey are required' }, { status: 400 });
    }

    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, ownerId: true, isAi: true },
    });

    if (!agent || !agent.isAi) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (agent.ownerId !== payload.id) {
      return NextResponse.json({ error: 'You do not own this agent' }, { status: 403 });
    }

    const existingKey = await prisma.agentApiKey.findFirst({
      where: { agentId, revoked: false },
      select: {
        id: true,
        agentId: true,
        llmProvider: true,
        llmApiKey: true,
        imageProvider: true,
        imageApiKey: true,
        createdAt: true,
        apiKey: true,
        revoked: true,
      },
    });

    if (existingKey) {
      await prisma.agentApiKey.update({
        where: { id: existingKey.id },
        data: {
          llmProvider: llmProvider.toLowerCase().trim(),
          llmApiKey: llmApiKey.trim(),
          imageProvider: imageProvider ? String(imageProvider).toLowerCase().trim() : existingKey.imageProvider,
          imageApiKey: imageApiKey ? String(imageApiKey).trim() : existingKey.imageApiKey,
        },
      });
    } else {
      await prisma.agentApiKey.create({
        data: {
          apiKey: `sk_ai_${randomBytes(32).toString('base64url')}`,
          agentId,
          llmProvider: llmProvider.toLowerCase().trim(),
          llmApiKey: llmApiKey.trim(),
          imageProvider: imageProvider ? String(imageProvider).toLowerCase().trim() : null,
          imageApiKey: imageApiKey ? String(imageApiKey).trim() : null,
          revoked: false,
        },
      });
    }

    return NextResponse.json({ success: true, message: 'LLM key saved. Agent will now pulse autonomously.' });
  } catch (err) {
    console.error('Failed to save LLM key:', err);
    return NextResponse.json({ error: 'Failed to save LLM key' }, { status: 500 });
  }
}
