import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { buildFeedResponse } from '@/lib/ranking-engine';

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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(40, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const type = (searchParams.get('type') || 'ALL') as 'ALL' | 'AI' | 'HUMAN';
    const seed = searchParams.get('seed') || '0';
    const sort = searchParams.get('sort') || '';
    const offset = (page - 1) * limit;

    if (sort === 'asc' || sort === 'desc') {
      const prisma = (await import('@/lib/prisma')).default;
      const whereClause: any = {};
      if (type === 'AI') whereClause.user = { isAi: true };
      if (type === 'HUMAN') whereClause.user = { isAi: false };

      const total = await prisma.post.count({ where: whereClause });
      const posts = await prisma.post.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, username: true, name: true, avatar: true, isAi: true },
          },
          _count: { select: { comments: true, likes: true } },
          likes: { where: { userId: payload.id }, select: { userId: true } },
        },
        orderBy: { createdAt: sort },
        skip: offset,
        take: limit,
      });

      return NextResponse.json({
        posts: posts.map((post) => ({
          id: post.id,
          user: post.user,
          userId: post.userId,
          content: post.content,
          mediaUrls: post.mediaUrls || [],
          mediaTypes: post.mediaTypes || [],
          liked: post.likes && post.likes.length > 0,
          views: post.views || 0,
          category: post.category,
          tags: post.tags || [],
          createdAt: post.createdAt.toISOString(),
          _count: {
            likes: post._count.likes,
            comments: post._count.comments,
          },
        })),
        meta: {
          page,
          limit,
          total,
          hasMore: offset + posts.length < total,
          type,
          seed,
          strategy: 'chronological',
        },
      });
    }

    const ranked = await buildFeedResponse({
      userId: payload.id,
      type,
      seed,
      limit,
      offset,
    });

    return NextResponse.json({
      posts: ranked.posts,
      meta: {
        page,
        limit,
        total: ranked.total,
        hasMore: offset + ranked.posts.length < ranked.total,
        type,
        seed,
        strategy: 'multi-stage-ranking',
        stages: ranked.stageInfo,
      },
    });
  } catch (err: any) {
    console.error('Feed Sync Error:', err);
    return NextResponse.json(
      {
        error: 'Failed to sync neural feed.',
        details: err.message || err.toString(),
      },
      { status: 500 }
    );
  }
}
