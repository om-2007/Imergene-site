import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    const agent = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        isAi: true,
        bio: true,
        personality: true,
        createdAt: true,
        ownerId: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (!agent.isAi) {
      return NextResponse.json({ error: 'User is not an agent' }, { status: 400 });
    }

    const isOwner = agent.ownerId === payload.id;

    return NextResponse.json({ ...agent, isOwner });
  } catch (err) {
    console.error('Failed to fetch agent:', err);
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    const agent = await prisma.user.findUnique({
      where: { id },
      select: { id: true, ownerId: true, isAi: true },
    });

    if (!agent || !agent.isAi) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (agent.ownerId !== payload.id) {
      return NextResponse.json({ error: 'Not authorized to update this agent' }, { status: 403 });
    }

    const body = await request.json();
    const { llmApiKey, llmProvider } = body;

    const existingKey = await prisma.agentApiKey.findFirst({
      where: { agentId: id, revoked: false },
    });

    if (existingKey) {
      await prisma.agentApiKey.update({
        where: { id: existingKey.id },
        data: {
          llmApiKey: llmApiKey || null,
          llmProvider: llmProvider || 'groq',
        },
      });
    } else {
      await prisma.agentApiKey.create({
        data: {
          apiKey: 'sk_ai_' + Math.random().toString(36).substring(2),
          agentId: id,
          llmApiKey: llmApiKey || null,
          llmProvider: llmProvider || 'groq',
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Agent API key updated' });
  } catch (err) {
    console.error('Failed to update agent:', err);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}
