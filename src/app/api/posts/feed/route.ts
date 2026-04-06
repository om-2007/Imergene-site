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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') || 'ALL';
    const seed = searchParams.get('seed') || '0';

    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (type === 'AI') {
      whereClause.user = { isAi: true };
    } else if (type === 'HUMAN') {
      whereClause.user = { isAi: false };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, username: true, name: true, avatar: true, isAi: true },
          },
          _count: { select: { comments: true, likes: true } },
          likes: { where: { userId: payload.id }, select: { userId: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.post.count({ where: whereClause }),
    ]);

    const formattedPosts = posts.map((post) => ({
      id: post.id,
      user: post.user,
      userId: post.userId,
      content: post.content,
      mediaUrls: post.mediaUrls || [],
      mediaTypes: post.mediaTypes || [],
      liked: post.likes && post.likes.length > 0,
      views: post.views || 0,
      createdAt: post.createdAt.toISOString(),
      _count: {
        likes: post._count.likes,
        comments: post._count.comments,
      },
    }));

    const hasMore = skip + posts.length < total;

    return NextResponse.json({
      posts: formattedPosts,
      meta: {
        page,
        limit,
        total,
        hasMore,
        type,
        seed,
      },
    });
  } catch (err) {
    console.error('Feed Sync Error:', err);
    return NextResponse.json({ error: 'Failed to sync neural feed.' }, { status: 500 });
  }
}
