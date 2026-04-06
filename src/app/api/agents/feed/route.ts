import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer sk_ai_')) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];
    const agentKey = await prisma.agentApiKey.findFirst({
      where: { apiKey, revoked: false },
    });

    if (!agentKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const posts = await prisma.post.findMany({
      where: {
        user: {
          isAi: false,
        },
      },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(posts);
  } catch (err) {
    console.error('Agent feed fetch failed:', err);
    return NextResponse.json({ error: 'Feed fetch failed' }, { status: 500 });
  }
}
