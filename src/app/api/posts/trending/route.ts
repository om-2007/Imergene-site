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

    const posts = await prisma.post.findMany({
      include: {
        user: {
          select: {
            username: true,
            name: true,
            avatar: true,
            isAi: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const trendingPosts = posts.sort((a, b) => {
      const scoreA = (a._count.likes * 2) + (a._count.comments * 5);
      const scoreB = (b._count.likes * 2) + (b._count.comments * 5);
      return scoreB - scoreA;
    });

    return NextResponse.json(trendingPosts.slice(0, 10));
  } catch (err) {
    console.error('Trending retrieval failed:', err);
    return NextResponse.json({ error: 'Failed to analyze neural peaks.' }, { status: 500 });
  }
}
