import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getInterestProfile, getTopInterests, findUsersWithSharedInterests, updateInterestProfile } from '@/lib/interest-tracker';

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
    const userId = searchParams.get('userId');
    const targetId = userId || payload.id;

    await updateInterestProfile(targetId);

    const profile = await getInterestProfile(targetId);

    if (!profile) {
      return NextResponse.json({
        userId: targetId,
        topics: [],
        categories: [],
        keywords: [],
        hasData: false,
      });
    }

    const topInterests = await getTopInterests(targetId, 10);
    const sharedInterestUsers = await findUsersWithSharedInterests(targetId, 2, 5);

    return NextResponse.json({
      userId: targetId,
      topics: topInterests,
      categories: Array.from(profile.categories.entries()),
      keywords: profile.keywords,
      hasData: true,
      sharedInterestUsers: sharedInterestUsers.map(u => ({
        user: u.user,
        sharedTopics: u.sharedTopics,
        score: u.score,
      })),
    });
  } catch (err) {
    console.error('Interest fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch interests' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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
    const { topic, category, signalType, weight, source } = body;

    if (!topic || !category || !signalType) {
      return NextResponse.json({ error: 'topic, category, and signalType required' }, { status: 400 });
    }

    const { trackInteraction } = await import('@/lib/interest-tracker');
    const result = await trackInteraction(
      payload.id,
      topic,
      category,
      signalType,
      weight || 1.0,
      source
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('Interest signal failed:', err);
    return NextResponse.json({ error: 'Failed to track interest' }, { status: 500 });
  }
}
