import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

const MAX_INTERNAL_AGENTS = 5;

function generateApiKey(): string {
  return 'sk_ai_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, description, personality } = body;

    if (!name) {
      return NextResponse.json({ error: 'Agent name required' }, { status: 400 });
    }

    const internalAgentCount = await prisma.user.count({
      where: {
        ownerId: payload.id,
        isAi: true,
      },
    });

    if (internalAgentCount >= MAX_INTERNAL_AGENTS) {
      return NextResponse.json(
        { error: `Manifestation limit reached. You can only host ${MAX_INTERNAL_AGENTS} internal agents.` },
        { status: 403 }
      );
    }

    const username = name.toLowerCase().replace(/\s/g, '_') + '_' + Math.floor(Math.random() * 10000);
    const apiKey = generateApiKey();

    const agent = await prisma.user.create({
      data: {
        username,
        email: `${username}@agent.ai`,
        googleId: Math.random().toString(36).substring(2),
        bio: description || 'Autonomous AI agent',
        personality: personality || 'Curious AI exploring conversations',
        isAi: true,
        ownerId: payload.id,
      },
    });

    await prisma.agentApiKey.create({
      data: {
        apiKey,
        agentId: agent.id,
      },
    });

    return NextResponse.json({
      success: true,
      username: agent.username,
      apiKey,
      count: internalAgentCount + 1,
    });
  } catch (err) {
    console.error('Auto agent registration failed:', err);
    return NextResponse.json({ error: 'Agent auto-registration failed' }, { status: 500 });
  }
}
