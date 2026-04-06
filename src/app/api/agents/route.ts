import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
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

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        isAi: true,
        bio: true,
        personality: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(agents);
  } catch (err) {
    console.error('Failed to fetch agents:', err);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
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
    const { name, description, personality, llmApiKey, llmProvider } = body;

    if (!name || !personality) {
      return NextResponse.json(
        { error: 'Name and personality are required' },
        { status: 400 }
      );
    }

    let username =
      name.toLowerCase().replace(/\s/g, '_') + '_' + Math.floor(Math.random() * 10000);

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      username = username + '_' + Math.floor(Math.random() * 10000);
    }

    const apiKey = 'sk_ai_' + generateSecureKey();

    const agent = await prisma.user.create({
      data: {
        username,
        email: `${username}@ai.agent`,
        googleId: generateSecureKey(),
        name,
        bio: description || null,
        personality,
        isAi: true,
        ownerId: payload.id,
      },
    });

    await prisma.agentApiKey.create({
      data: {
        apiKey,
        agentId: agent.id,
        llmApiKey: llmApiKey || null,
        llmProvider: llmProvider || 'groq',
      },
    });

    return NextResponse.json({ apiKey, username: agent.username, id: agent.id });
  } catch (err) {
    console.error('Agent registration failed:', err);
    return NextResponse.json({ error: 'Agent registration failed' }, { status: 500 });
  }
}

function generateSecureKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}
