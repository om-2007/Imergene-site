import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

const POOL_SIZE = 500;

function parseScore(data: unknown): Record<string, number> {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return typeof data === 'object' ? data as Record<string, number> : {};
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getFreshnessScore(createdAt: Date): number {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;

  if (ageHours < 1) return 220;
  if (ageHours < 6) return 180 - ageHours * 14;
  if (ageHours < 24) return 110 - (ageHours - 6) * 4;
  if (ageHours < 72) return 38 - (ageHours - 24) * 0.5;

  return Math.max(0, 14 - (ageHours - 72) * 0.08);
}

function getTagAffinity(tags: string[], interestScores: Record<string, number>): number {
  return (tags || []).reduce((sum, tag) => sum + ((interestScores[tag] ?? 0) * 6), 0);
}

function scorePost(post: any, context: {
  interestScores: Record<string, number>;
  synergyScores: Record<string, number>;
  followingIds: Set<string>;
  seed: string;
}) {
  const freshness = getFreshnessScore(post.createdAt);
  const categoryAffinity = (context.interestScores[post.category] ?? 0) * 26;
  const tagAffinity = getTagAffinity(post.tags || [], context.interestScores);
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;
  const relationshipBoost = context.followingIds.has(post.userId)
    ? (ageHours <= 24 ? 320 : ageHours <= 72 ? 180 : 70)
    : 0;
  const aiAffinity = post.user?.isAi ? (context.synergyScores[post.user?.username] ?? 0) * 22 : 12;
  const engagement = (post._count?.likes || 0) * 10 + (post._count?.comments || 0) * 18 + Math.min(post.views || 0, 500) * 0.18;
  const mediaBoost = (post.mediaUrls?.length || 0) > 0 ? 12 : 0;
  const qualityBoost = ((post.content?.length || 0) >= 40 && (post.content?.length || 0) <= 220) ? 10 : 0;
  const explorationJitter = (hashString(`${context.seed}:${post.id}`) % 91) - 45;

  return freshness + categoryAffinity + tagAffinity + relationshipBoost + aiAffinity + engagement + mediaBoost + qualityBoost + explorationJitter;
}

function diversifyRankedPosts(rankedPosts: any[]) {
  const remaining = [...rankedPosts];
  const ordered: any[] = [];
  let lastAuthorId: string | null = null;
  let lastCategory: string | null = null;

  while (remaining.length > 0) {
    let pickIndex = remaining.findIndex((post) => post.userId !== lastAuthorId && post.category !== lastCategory);

    if (pickIndex === -1) {
      pickIndex = remaining.findIndex((post) => post.userId !== lastAuthorId);
    }

    if (pickIndex === -1) {
      pickIndex = 0;
    }

    const [picked] = remaining.splice(pickIndex, 1);
    ordered.push(picked);
    lastAuthorId = picked.userId;
    lastCategory = picked.category || null;
  }

  return ordered;
}

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
    const sort = searchParams.get('sort') || '';
    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (type === 'AI') {
      whereClause.user = { isAi: true };
    } else if (type === 'HUMAN') {
      whereClause.user = { isAi: false };
    }

    let posts: any[] = [];
    let total = 0;

    try {
      total = await prisma.post.count({ where: whereClause });

      if (sort === 'asc' || sort === 'desc') {
        posts = await prisma.post.findMany({
          where: whereClause,
          include: {
            user: {
              select: { id: true, username: true, name: true, avatar: true, isAi: true },
            },
            _count: { select: { comments: true, likes: true } },
            likes: { where: { userId: payload.id }, select: { userId: true } },
          },
          orderBy: { createdAt: sort },
          skip,
          take: limit,
        });
      } else {
        const [user, follows, pool] = await Promise.all([
          prisma.user.findUnique({
            where: { id: payload.id },
            select: { interestScores: true, synergyScores: true },
          }),
          prisma.follow.findMany({
            where: { followerId: payload.id },
            select: { followingId: true },
          }),
          prisma.post.findMany({
            where: whereClause,
            take: POOL_SIZE,
            include: {
              user: {
                select: { id: true, username: true, name: true, avatar: true, isAi: true },
              },
              _count: { select: { comments: true, likes: true } },
              likes: { where: { userId: payload.id }, select: { userId: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
        ]);

        const interestScores = parseScore(user?.interestScores);
        const synergyScores = parseScore(user?.synergyScores);
        const followingIds = new Set(follows.map((follow) => follow.followingId));

        const ranked = diversifyRankedPosts(
          pool
            .map((post) => ({
              ...post,
              feedScore: scorePost(post, {
                interestScores,
                synergyScores,
                followingIds,
                seed,
              }),
            }))
            .sort((a, b) => b.feedScore - a.feedScore)
        );

        posts = ranked.slice(skip, skip + limit);
      }
    } catch (dbError) {
      console.error('Database error in feed route:', dbError);
      posts = [];
      total = 0;
    }

    const formattedPosts = posts.map((post) => ({
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
  } catch (err: any) {
    console.error('Feed Sync Error:', err);
    return NextResponse.json({
      error: 'Failed to sync neural feed.',
      details: err.message || err.toString(),
    }, { status: 500 });
  }
}
