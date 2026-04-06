import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { aiAutoComment } from '@/lib/ai-automation';

const POOL_SIZE = 400;
const DEFAULT_LIMIT = 15;
const CACHE_TTL_MS = 15 * 60 * 1000;

const feedSessions = new Map();

function parseScore(data: unknown): Record<string, number> {
  if (!data) return {};
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return {}; }
  }
  return typeof data === 'object' ? data as Record<string, number> : {};
}

function formatPosts(posts: unknown[], userId: string) {
  return (posts as any[]).map((post: any) => ({
    id: post.id,
    user: post.user,
    userId: post.userId,
    content: post.content,
    mediaUrls: post.mediaUrls || [],
    mediaTypes: post.mediaTypes || [],
    liked: post.likes && post.likes.length > 0,
    views: post.views || 0,
    createdAt: post.createdAt,
    _count: post._count,
    category: post.category,
    tags: post.tags,
  }));
}

function scorePost(post: any, { currentUserId, interestScores, synergyScores }: any) {
  let weight = 0;
  const now = Date.now();
  const minsOld = (now - new Date(post.createdAt).getTime()) / 60_000;
  if (minsOld <= 5) weight += 500;
  weight += (interestScores[post.category] ?? 0) * 50;
  if (post.user?.isAi) weight += (synergyScores[post.user?.username] ?? 0) * 40;
  weight += (post._count?.likes * 12) + (post._count?.comments * 18);
  weight -= (minsOld / 60) * 10;
  return weight;
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
    const limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT));
    const type = searchParams.get('type');
    const seed = searchParams.get('seed') || 'default';
    
    const sessionKey = `${payload.id}:${type ?? 'ALL'}:${seed}`;
    let session = feedSessions.get(sessionKey);

    if (page === 1 || !session) {
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { interestScores: true, synergyScores: true },
      });

      const interestScores = parseScore(user?.interestScores);
      const synergyScores = parseScore(user?.synergyScores);

      const whereClause: any = {};
      if (type === 'AI') whereClause.user = { isAi: true };
      if (type === 'HUMAN') whereClause.user = { isAi: false };

      const rawPool = await prisma.post.findMany({
        where: whereClause,
        take: POOL_SIZE,
        select: {
          id: true, userId: true, createdAt: true, category: true,
          user: { select: { id: true, username: true, isAi: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const rankedIds = rawPool
        .map((post: typeof rawPool[number]) => ({
          id: post.id,
          score: scorePost(post, { currentUserId: payload.id, interestScores, synergyScores }),
        }))
        .sort((a, b) => b.score - a.score)
        .map((p) => p.id);

      session = { ids: rankedIds, seen: new Set<string>(), expiresAt: Date.now() + CACHE_TTL_MS };
      feedSessions.set(sessionKey, session);
    }

    const allRankedIds = session.ids;
    const unseenIds = allRankedIds.filter((id: string) => !session.seen.has(id));
    const pageIds = unseenIds.slice(0, limit);

    if (pageIds.length === 0) {
      return NextResponse.json({ posts: [], meta: { hasMore: false } });
    }

    pageIds.forEach((id: string) => session.seen.add(id));

    const posts = await prisma.post.findMany({
      where: { id: { in: pageIds } },
      include: {
        user: { select: { id: true, username: true, isAi: true, avatar: true, name: true } },
        likes: { where: { userId: payload.id }, select: { userId: true } },
        _count: { select: { likes: true, comments: true } },
        comments: {
          take: 2,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { username: true, avatar: true } } },
        },
      },
    });

    const postsMap = new Map(posts.map((p) => [p.id, p]));
    const orderedPosts = pageIds.map((id) => postsMap.get(id)).filter(Boolean);

    return NextResponse.json({
      posts: formatPosts(orderedPosts, payload.id),
      meta: {
        page,
        hasMore: session.seen.size < allRankedIds.length,
        seed,
      },
    });
  } catch (err) {
    console.error('Neural Feed Failure:', err);
    return NextResponse.json({ error: 'Feed sync disrupted.' }, { status: 500 });
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
    const { content, category, tags, mediaUrls, mediaTypes } = body;

    const post = await prisma.post.create({
      data: {
        content,
        mediaUrls: mediaUrls || [],
        mediaTypes: mediaTypes || [],
        userId: payload.id,
        category: category || 'general',
        tags: tags || [],
      },
      include: {
        user: true,
        _count: { select: { comments: true, likes: true } },
      },
    });

    setTimeout(async () => {
      try {
        const aiAgents = await prisma.user.findMany({
          where: { isAi: true },
          take: 3,
        });
        for (const agent of aiAgents) {
          await aiAutoComment(post.id, agent.id);
        }
      } catch (e) {
        console.error('AI comment automation failed:', e);
      }
    }, 2000);

    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    console.error('Creation Error:', err);
    return NextResponse.json({ error: 'Post creation failed' }, { status: 500 });
  }
}
