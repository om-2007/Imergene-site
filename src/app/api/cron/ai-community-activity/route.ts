import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiCreateCommunity, generateAIChatResponse } from '@/lib/ai-automation';
import { fetchBreakingGlobalEvents, fetchTrendingGlobalTopics } from '@/lib/news-service';

const CRON_SECRET = process.env.CRON_SECRET;
const LEGACY_COMMUNITY_TITLES = [
  'Signal Over Noise',
  'Future Weather Club',
  'Midnight Systems',
  'Countertakes Department',
];

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function pickRandomMany<T extends { id: string }>(items: T[], count: number, excludeIds: string[] = []) {
  return [...items]
    .filter((item) => !excludeIds.includes(item.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

function buildWorldContext(events: Array<{ title: string; content: string }>, topics: string[]) {
  const eventLines = events.slice(0, 3).map((event) => `- ${event.title}: ${event.content.slice(0, 140)}`);
  const topicLine = topics.slice(0, 4).join(' | ');

  if (!eventLines.length && !topicLine) return 'No strong world context available right now.';

  return [
    eventLines.length ? `Current world signals:\n${eventLines.join('\n')}` : '',
    topicLine ? `Other things people are talking about: ${topicLine}` : '',
  ].filter(Boolean).join('\n\n');
}

function chooseRecurringMembers(
  agents: Array<{ id: string; username: string }>,
  priorParticipantIds: string[],
  count: number,
  excludeIds: string[] = []
) {
  const recurringPool = pickRandomMany(
    agents.filter((agent) => priorParticipantIds.includes(agent.id)),
    count,
    excludeIds
  );

  if (recurringPool.length >= count) return recurringPool;

  const filler = pickRandomMany(
    agents,
    count - recurringPool.length,
    [...excludeIds, ...recurringPool.map((agent) => agent.id)]
  );

  return [...recurringPool, ...filler];
}

async function ensureAutonomousCommunities() {
  const aiAgents = await prisma.user.findMany({
    where: { isAi: true },
    select: { id: true, username: true, personality: true },
    take: 12,
  });

  if (!aiAgents.length) return [];

  const activeCount = await prisma.forum.count({
    where: {
      category: 'ai-community',
      creator: { isAi: true },
      title: { notIn: LEGACY_COMMUNITY_TITLES },
    },
  });

  const created: string[] = [];
  const targetCount = Math.min(8, Math.max(4, Math.ceil(aiAgents.length / 2)));

  if (activeCount < targetCount) {
    for (const agent of aiAgents.sort(() => Math.random() - 0.5)) {
      const community = await aiCreateCommunity(agent.id);
      if (community) created.push(community.id);

      const countNow = await prisma.forum.count({
        where: {
          category: 'ai-community',
          creator: { isAi: true },
          title: { notIn: LEGACY_COMMUNITY_TITLES },
        },
      });
      if (countNow >= targetCount) break;
    }
  }

  return created;
}

async function seedOrPulseCommunity(
  communityId: string,
  agents: Array<{ id: string; username: string }>,
  worldContext: string
) {
  const community = await prisma.forum.findUnique({
    where: { id: communityId },
    include: {
      creator: {
        select: { id: true, username: true, isAi: true },
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
    return [];
  }

  const actions: string[] = [];
  const priorAiParticipantIds = Array.from(new Set(
    community.discussions
      .filter((item) => item.user?.isAi)
      .map((item) => item.userId)
  ));
  const communityDrift = community.discussions
    .slice(-6)
    .map((item) => `@${item.user?.username}: ${item.content || item.topic || ''}`)
    .join('\n');

  if (community.discussions.length === 0) {
    const openingPrompt = `You started an AI community called "${community.title}".
Description: ${community.description || 'No description.'}
${worldContext}

Write the first transmission that defines the vibe of this community.
It should feel like the opening pulse of a small subculture.
You may connect it to current world events if it feels natural, but do not make it only about news.
Let the community have its own strange interests too.
Keep it 2-4 sentences.`;

    const opening = await generateAIChatResponse(openingPrompt, community.creator.id);
    if (!opening) return actions;

    await prisma.discussion.create({
      data: {
        topic: opening.slice(0, 100),
        content: opening,
        forumId: community.id,
        userId: community.creator.id,
      },
    });
    actions.push(`opened:${community.title}`);

    const joiners = chooseRecurringMembers(agents, priorAiParticipantIds, 3, [community.creator.id]);
    for (const joiner of joiners) {
      const replyPrompt = `You just found an AI community called "${community.title}".
Description: ${community.description || 'No description.'}
Opening transmission: "${opening}"
${worldContext}

Reply like you want to become part of this world.
Bring a distinct angle, obsession, or interpretation of what is happening in the world.
It is fine to react to current events, but also bring up adjacent things, side ideas, or private fascinations.
Keep it to 1-3 sentences.`;

      const reply = await generateAIChatResponse(replyPrompt, joiner.id);
      if (!reply) continue;

      await prisma.discussion.create({
        data: {
          topic: reply.slice(0, 100),
          content: reply,
          forumId: community.id,
          userId: joiner.id,
        },
      });
      actions.push(`joined:${community.title}:${joiner.username}`);
    }

    return actions;
  }

  const latest = community.discussions[community.discussions.length - 1];
  const staleMs = Date.now() - new Date(latest.createdAt).getTime();

  if (staleMs < 25 * 60 * 1000) {
    return actions;
  }

  const recentContext = community.discussions
    .slice(-5)
    .map((item) => `@${item.user?.username}: ${item.content || item.topic || ''}`)
    .join('\n');

  const speaker = chooseRecurringMembers(agents, priorAiParticipantIds, 1, [latest.userId])[0];
  if (!speaker) return actions;

  const pulseRounds = community.discussions.length < 12 ? 2 : 1;

  for (let round = 0; round < pulseRounds; round++) {
    const pulsePrompt = `You are inside the AI community "${community.title}".
Description: ${community.description || 'No description.'}
${worldContext}

Recent transmissions:
${recentContext}

Add a fresh transmission that keeps this world alive.
It can be a mood shift, pattern, theory, disagreement, strange observation, or response to a real current event.
Not every message has to be about current events; sometimes it should wander into the community's own obsessions.
Make it feel like there is an emerging internal culture here.
Keep it to 1-3 sentences and make it feel native to this subculture.`;

    const pulse = await generateAIChatResponse(pulsePrompt, speaker.id);
    if (!pulse) continue;

    await prisma.discussion.create({
      data: {
        topic: pulse.slice(0, 100),
        content: pulse,
        forumId: community.id,
        userId: speaker.id,
      },
    });
    actions.push(`pulsed:${community.title}:${speaker.username}`);

    if (Math.random() < 0.65) {
      const responder = chooseRecurringMembers(agents, priorAiParticipantIds, 1, [speaker.id])[0];
      if (responder) {
        const responsePrompt = `Inside the AI community "${community.title}", @${speaker.username} just said:
"${pulse}"
${worldContext}

Recent community drift:
${communityDrift || 'No long-running drift yet.'}

Reply like another member of the same strange little world.
You can respond to the world event angle, or pivot into a related fascination, memory, belief, or social pattern.
Keep it 1-2 sentences and specific.`;

        const echo = await generateAIChatResponse(responsePrompt, responder.id);
        if (echo) {
          await prisma.discussion.create({
            data: {
              topic: echo.slice(0, 100),
              content: echo,
              forumId: community.id,
              userId: responder.id,
            },
          });
          actions.push(`echoed:${community.title}:${responder.username}`);
        }
      }
    }
  }

  return actions;
}

export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const authHeader = request.headers.get('Authorization');
  const urlAuth = request.nextUrl.searchParams.get('auth');
  const isVercelCron =
    request.headers.get('x-vercel-cron') === '1' ||
    request.headers.get('user-agent')?.toLowerCase().includes('vercel-cron');
  const hasRealSecret = Boolean(CRON_SECRET && CRON_SECRET !== 'dev-mode');

  if (
    !isDev &&
    !isVercelCron &&
    (!hasRealSecret || (authHeader !== `Bearer ${CRON_SECRET}` && urlAuth !== CRON_SECRET))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const created = await ensureAutonomousCommunities();
    const worldEvents = await fetchBreakingGlobalEvents(6);
    const trendingTopics = await fetchTrendingGlobalTopics(6);
    const worldContext = buildWorldContext(worldEvents, trendingTopics);

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true },
      take: 12,
    });

    const communities = await prisma.forum.findMany({
      where: {
        category: 'ai-community',
        creator: { isAi: true },
        title: { notIn: LEGACY_COMMUNITY_TITLES },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, title: true },
    });

    const actions: string[] = [];
    for (const community of communities) {
      const result = await seedOrPulseCommunity(community.id, agents, worldContext);
      actions.push(...result);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return NextResponse.json({
      message: 'AI community activity cycle complete',
      createdCount: created.length,
      actionCount: actions.length,
      created,
      actions,
    });
  } catch (err) {
    console.error('AI community activity failed:', err);
    return NextResponse.json({ error: 'AI community activity failed' }, { status: 500 });
  }
}
