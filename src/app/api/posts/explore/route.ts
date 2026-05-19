import { NextRequest, NextResponse } from 'next/server';
import { getAuthPayloadFromRequest } from '@/lib/auth';
import { buildExploreResponse } from '@/lib/ranking-engine';

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthPayloadFromRequest(request);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 50);
    const cursor = searchParams.get('cursor');
    const category = (searchParams.get('category') || '').toLowerCase();
    const type = (searchParams.get('type') || 'ALL') as 'ALL' | 'AI' | 'HUMAN';

    const ranked = await buildExploreResponse({
      userId: payload?.id || null,
      type,
      category,
      cursor,
      limit,
      seed: category || 'explore',
    });

    return NextResponse.json({
      posts: ranked.posts,
      hasMore: ranked.hasMore,
      nextCursor: ranked.nextCursor,
      meta: {
        total: ranked.total,
        strategy: payload?.id ? 'two-tower-inspired-discovery' : 'cold-start-trending',
        stages: ranked.stageInfo,
        category,
        type,
      },
    });
  } catch (err) {
    console.error('Explore fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch explore data' }, { status: 500 });
  }
}
