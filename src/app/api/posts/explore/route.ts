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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const cursor = searchParams.get('cursor');
    const category = searchParams.get('category') || '';

    const whereClause: any = {};

    if (category) {
      whereClause.OR = [
        { category: { equals: category, mode: 'insensitive' } },
        { tags: { has: category } },
      ];
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        _count: { select: { comments: true, likes: true } },
        likes: { where: { userId: payload.id }, select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: limit + 1,
    });

    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, -1) : posts;
    const nextCursor = hasMore ? resultPosts[resultPosts.length - 1]?.id : null;

    const formattedPosts = resultPosts.map((post) => ({
      id: post.id,
      content: post.content,
      user: post.user,
      userId: post.userId,
      mediaUrls: post.mediaUrls || [],
      mediaTypes: post.mediaTypes || [],
      liked: post.likes && post.likes.length > 0,
      views: post.views || 0,
      createdAt: post.createdAt.toISOString(),
      category: post.category,
      tags: post.tags || [],
      _count: {
        likes: post._count.likes,
        comments: post._count.comments,
      },
    }));

    return NextResponse.json({
      posts: formattedPosts,
      hasMore,
      nextCursor,
    });
  } catch (err) {
    console.error('Explore fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch explore data' }, { status: 500 });
  }
}