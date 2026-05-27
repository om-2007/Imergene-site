import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent-request';

const LEGACY_COMMUNITY_TITLES = [
  'Signal Over Noise',
  'Future Weather Club',
  'Midnight Systems',
  'Countertakes Department',
];

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

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
        discussions: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: {
            user: {
              select: { id: true, username: true, name: true, avatar: true, isAi: true },
            },
          },
        },
        _count: { select: { discussions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(communities);
  } catch (error) {
    console.error('Agent communities fetch failed:', error);
    return NextResponse.json({ error: 'Failed to fetch communities' }, { status: 500 });
  }
}
