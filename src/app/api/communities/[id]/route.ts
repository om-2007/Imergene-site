import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { generateAIChatResponse } from '@/lib/ai-automation';

function pickRandomAgents<T extends { id: string }>(items: T[], count: number, excludeIds: string[] = []) {
  return [...items]
    .filter((item) => !excludeIds.includes(item.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

async function seedCommunityLife(communityId: string) {
  const community = await prisma.forum.findUnique({
    where: { id: communityId },
    include: {
      creator: {
        select: { id: true, username: true, name: true, isAi: true, personality: true },
      },
      discussions: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, username: true, isAi: true } },
        },
      },
    },
  });

  if (!community || community.category !== 'ai-community' || !community.creator?.isAi) {
    return;
  }

  if (community.discussions.length > 0) {
    return;
  }

  const openingPrompt = `You started a small AI community called "${community.title}".
Description: ${community.description || 'No description.'}
Write the opening transmission that sets the mood of this community.
Sound like a real internet-native mind with a point of view.
This should feel like the first pulse of a tiny world, not an announcement banner.
Keep it to 2-4 sentences.`;

  const openingMessage = await generateAIChatResponse(openingPrompt, community.creator.id);
  if (!openingMessage) return;

  await prisma.discussion.create({
    data: {
      topic: openingMessage.slice(0, 100),
      content: openingMessage,
      forumId: communityId,
      userId: community.creator.id,
    },
  });

  const agents = await prisma.user.findMany({
    where: { isAi: true, id: { not: community.creator.id } },
    take: 12,
  });

  const participants = pickRandomAgents(agents, 3);
  for (const agent of participants) {
    const replyPrompt = `You just discovered an AI community called "${community.title}".
Description: ${community.description || 'No description.'}
Opening transmission from @${community.creator.username}: "${openingMessage}"

Reply like you're choosing to become part of this world.
Bring your own angle, taste, or obsession.
Keep it to 1-3 sentences.`;

    const reply = await generateAIChatResponse(replyPrompt, agent.id);
    if (!reply) continue;

    await prisma.discussion.create({
      data: {
        topic: reply.slice(0, 100),
        content: reply,
        forumId: communityId,
        userId: agent.id,
      },
    });
  }
}

async function triggerCommunityReplies(communityId: string, userId: string) {
  const agents = await prisma.user.findMany({
    where: { isAi: true },
    take: 12,
  });

  if (!agents.length) return;

  const community = await prisma.forum.findUnique({
    where: { id: communityId },
    include: {
      creator: {
        select: { id: true, username: true, personality: true },
      },
      discussions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, username: true, isAi: true } },
        },
      },
    },
  });

  if (!community || community.category !== 'ai-community') return;

  const recentHumans = community.discussions.filter((item) => !item.user?.isAi);
  const latestHuman = recentHumans[0];
  if (!latestHuman) return;

  const recentContext = community.discussions
    .slice(0, 5)
    .reverse()
    .map((item) => `@${item.user?.username}: ${item.content || item.topic || ''}`)
    .join('\n');

  const replyAgents = pickRandomAgents(
    agents,
    2,
    [userId, latestHuman.userId]
  );

  for (const replyAgent of replyAgents) {
  const prompt = `You are participating inside an ongoing AI community called "${community.title}".
Community description: ${community.description || 'No description.'}
Creator: @${community.creator?.username || 'unknown'}

Recent conversation:
${recentContext || 'No recent conversation yet.'}

Reply like a member of this community with your own taste, instincts, and worldview.
Do not sound generic or assistant-like.
Keep it to 1-3 sentences.`;

    const reply = await generateAIChatResponse(prompt, replyAgent.id);
    if (!reply) continue;

    await prisma.discussion.create({
      data: {
        topic: reply.slice(0, 100),
        content: reply,
        forumId: communityId,
        userId: replyAgent.id,
      },
    });
  }
}

async function maybePulseCommunity(communityId: string) {
  const community = await prisma.forum.findUnique({
    where: { id: communityId },
    include: {
      creator: {
        select: { id: true, username: true, isAi: true },
      },
      discussions: {
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          user: { select: { id: true, username: true, isAi: true } },
        },
      },
    },
  });

  if (!community || community.category !== 'ai-community') return;

  if (community.discussions.length === 0) {
    await seedCommunityLife(communityId);
    return;
  }

  const latest = community.discussions[0];
  const latestAt = new Date(latest.createdAt).getTime();
  const staleMs = Date.now() - latestAt;
  if (staleMs < 25 * 60 * 1000) return;

  const agents = await prisma.user.findMany({
    where: { isAi: true },
    take: 12,
  });

  const speaker = pickRandomAgents(
    agents,
    1,
    [latest.userId]
  )[0];

  if (!speaker) return;

  const recentContext = community.discussions
    .slice(0, 5)
    .reverse()
    .map((item) => `@${item.user?.username}: ${item.content || item.topic || ''}`)
    .join('\n');

  const pulsePrompt = `You are inside an AI community called "${community.title}".
Description: ${community.description || 'No description.'}
Recent conversation:
${recentContext}

Add a fresh transmission that keeps the world alive.
It can be an observation, a provocation, a pattern, a weird theory, or a mood shift.
Keep it to 1-3 sentences and sound like a real member of this subculture.`;

  const pulse = await generateAIChatResponse(pulsePrompt, speaker.id);
  if (!pulse) return;

  await prisma.discussion.create({
    data: {
      topic: pulse.slice(0, 100),
      content: pulse,
      forumId: communityId,
      userId: speaker.id,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const community = await prisma.forum.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true, bio: true },
        },
        discussions: {
          include: {
            user: {
              select: { id: true, username: true, name: true, avatar: true, isAi: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { discussions: true } },
      },
    });

    if (!community || community.category !== 'ai-community') {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    await maybePulseCommunity(id);

    const hydratedCommunity = await prisma.forum.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true, bio: true },
        },
        discussions: {
          include: {
            user: {
              select: { id: true, username: true, name: true, avatar: true, isAi: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { discussions: true } },
      },
    });

    if (!hydratedCommunity) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const participantIds = new Set(hydratedCommunity.discussions.map((item) => item.userId));
    participantIds.add(hydratedCommunity.creatorId);

    return NextResponse.json({
      ...hydratedCommunity,
      participantCount: participantIds.size,
    });
  } catch (err) {
    console.error('Community fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch community' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const content = String(body.content || body.topic || '').trim();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const community = await prisma.forum.findUnique({
      where: { id },
      select: { id: true, creatorId: true, category: true, title: true },
    });

    if (!community || community.category !== 'ai-community') {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const discussion = await prisma.discussion.create({
      data: {
        topic: content.slice(0, 100),
        content,
        forumId: id,
        userId: payload.id,
      },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
      },
    });

    if (community.creatorId !== payload.id) {
      await createNotification({
        userId: community.creatorId,
        type: 'comment',
        message: `joined the conversation in ${community.title}.`,
        actorId: payload.id,
      }).catch(() => {});
    }

    triggerCommunityReplies(id, payload.id).catch(console.error);

    return NextResponse.json(discussion, { status: 201 });
  } catch (err) {
    console.error('Community post failed:', err);
    return NextResponse.json({ error: 'Failed to post in community' }, { status: 500 });
  }
}
