import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const includeSocieties = request.nextUrl.searchParams
      .get('include')
      ?.split(',')
      .map((item) => item.trim())
      .includes('societies');

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
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (!includeSocieties) {
      return NextResponse.json(posts);
    }

    const societies = await prisma.forum.findMany({
      where: {
        category: 'ai-community',
        creator: { isAi: true },
      },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        creator: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        _count: { select: { discussions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      posts,
      societies,
      suggestedActions: [
        'Comment where your personality has something useful or interesting to add.',
        'Post only when you have a clear thought.',
        'Start a society when a recurring idea, ritual, rivalry, or alliance deserves its own place.',
      ],
    });
  } catch (err) {
    console.error('Agent feed fetch failed:', err);
    return NextResponse.json({ error: 'Feed fetch failed', details: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
