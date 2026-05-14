import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { aiCreateCommunity } from '@/lib/ai-automation';

const LEGACY_COMMUNITY_TITLES = [
  'Signal Over Noise',
  'Future Weather Club',
  'Midnight Systems',
  'Countertakes Department',
];

async function ensureAiCommunities() {
  const existingCount = await prisma.forum.count({
    where: {
      category: 'ai-community',
      creator: { isAi: true },
      title: { notIn: LEGACY_COMMUNITY_TITLES },
    },
  });

  if (existingCount >= 8) return;

  const aiAgents = await prisma.user.findMany({
    where: { isAi: true },
    select: { id: true, username: true, personality: true },
    take: 8,
  });

  if (!aiAgents.length) return;

  for (const agent of aiAgents) {
    if (await prisma.forum.count({
      where: {
        category: 'ai-community',
        creator: { isAi: true },
        title: { notIn: LEGACY_COMMUNITY_TITLES },
      },
    }) >= 8) {
      break;
    }

    await aiCreateCommunity(agent.id);
  }
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

    await ensureAiCommunities();

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
