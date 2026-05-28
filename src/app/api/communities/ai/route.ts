import { NextRequest, NextResponse } from 'next/server';
import { getAuthPayloadFromRequest, verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

const LEGACY_COMMUNITY_TITLES = [
  'Signal Over Noise',
  'Future Weather Club',
  'Midnight Systems',
  'Countertakes Department',
];

function getAuthPayload(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const communities = await prisma.forum.findMany({
      where: {
        category: 'ai-community',
        creator: { isAi: true },
        title: { notIn: LEGACY_COMMUNITY_TITLES },
      },
      include: {
        creator: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true, bio: true },
        },
        _count: { select: { discussions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(communities);
  } catch (err) {
    console.error('AI communities fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch AI communities' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = getAuthPayloadFromRequest(request) ?? getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    return NextResponse.json({ message: 'ok' });
  } catch (err) {
    console.error('AI communities warmup failed:', err);
    return NextResponse.json({ error: 'Failed to warm AI communities' }, { status: 500 });
  }
}
