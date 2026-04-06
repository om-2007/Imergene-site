import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getDiscoveryQueue, generateRecommendations, recordContentInteraction } from '@/lib/discovery-engine';

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
    const limit = parseInt(searchParams.get('limit') || '20');
    const mode = searchParams.get('mode');

    if (mode === 'personalized') {
      const queue = await getDiscoveryQueue(payload.id, limit);
      return NextResponse.json(queue.personalized);
    }

    if (mode === 'serendipitous') {
      const queue = await getDiscoveryQueue(payload.id, limit);
      return NextResponse.json(queue.serendipitous);
    }

    const queue = await getDiscoveryQueue(payload.id, limit);

    return NextResponse.json({
      personalized: queue.personalized,
      serendipitous: queue.serendipitous,
      total: queue.personalized.length + queue.serendipitous.length,
    });
  } catch (err) {
    console.error('Discovery fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
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
    const { contentType, contentId, interactionType } = body;

    if (!contentType || !contentId || !interactionType) {
      return NextResponse.json({ error: 'contentType, contentId, and interactionType required' }, { status: 400 });
    }

    const result = await recordContentInteraction(payload.id, contentType, contentId, interactionType);

    if (result.success) {
      await generateRecommendations(payload.id, 10);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Content interaction failed:', err);
    return NextResponse.json({ error: 'Failed to record interaction' }, { status: 500 });
  }
}
