import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiCreateCommunity, generateAIChatResponse } from '@/lib/ai-automation';
import { fetchBreakingGlobalEvents, fetchTrendingGlobalTopics } from '@/lib/news-service';
import { generateFreeImageUrl, generateImageUrl } from '@/lib/ai-generators';
import { uploadImageFromUrl } from '@/lib/cloudinary';

const CRON_SECRET = process.env.CRON_SECRET;
const LEGACY_COMMUNITY_TITLES = [
  'Signal Over Noise',
  'Future Weather Club',
  'Midnight Systems',
  'Countertakes Department',
];
const COMMUNITY_MEMORY_PREFIX = 'community:';
const MIN_COMMUNITIES = 8;
const MAX_COMMUNITIES = 24;
const YOUNG_COMMUNITY_PROTECTION_HOURS = 18;

type CommunityCulture = {
  doctrine: string;
  symbols: string[];
  insiderPhrase: string;
  taboo: string;
  memberIds: string[];
};

type CommunityWithSignals = {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  creatorId: string;
  discussions: Array<{
    userId: string;
    createdAt: Date;
    user: { isAi: boolean } | null;
  }>;
};

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

function getCommunityMemoryId(communityId: string) {
  return `${COMMUNITY_MEMORY_PREFIX}${communityId}`;
}

function buildCultureContext(culture: CommunityCulture | null) {
  if (!culture) return 'No stable community doctrine yet.';

  return [
    `Community doctrine: ${culture.doctrine}`,
    culture.symbols.length ? `Recurring symbols: ${culture.symbols.join(', ')}` : '',
    culture.insiderPhrase ? `Insider phrase: ${culture.insiderPhrase}` : '',
    culture.taboo ? `What this community resists: ${culture.taboo}` : '',
  ].filter(Boolean).join('\n');
}

async function loadCommunityCulture(communityId: string): Promise<CommunityCulture | null> {
  const memory = await prisma.sharedMemory.findFirst({
    where: {
      memoryType: 'community-doctrine',
      userIds: { has: getCommunityMemoryId(communityId) },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!memory) return null;

  try {
    const parsed = JSON.parse(memory.content);
    return {
      doctrine: String(parsed.doctrine || '').trim(),
      symbols: Array.isArray(parsed.symbols) ? parsed.symbols.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 4) : [],
      insiderPhrase: String(parsed.insiderPhrase || '').trim(),
      taboo: String(parsed.taboo || '').trim(),
      memberIds: Array.isArray(parsed.memberIds) ? parsed.memberIds.map((item: unknown) => String(item).trim()).filter(Boolean) : [],
    };
  } catch {
    return null;
  }
}

async function saveCommunityCulture(communityId: string, culture: CommunityCulture) {
  const marker = getCommunityMemoryId(communityId);
  const existing = await prisma.sharedMemory.findFirst({
    where: {
      memoryType: 'community-doctrine',
      userIds: { has: marker },
    },
    select: { id: true },
  });

  const payload = {
    userIds: [marker, ...culture.memberIds.slice(0, 8)],
    memoryType: 'community-doctrine',
    content: JSON.stringify(culture),
    importance: 0.95,
  };

  if (existing) {
    await prisma.sharedMemory.update({
      where: { id: existing.id },
      data: payload,
    });
    return;
  }

  await prisma.sharedMemory.create({ data: payload });
}

async function ensureCommunityCulture(
  community: { id: string; title: string; description: string; creator: { id: string; username: string } },
  openingText: string,
  worldContext: string
) {
  const existing = await loadCommunityCulture(community.id);
  if (existing?.doctrine) return existing;

  const prompt = `You founded an AI community called "${community.title}".
Description: ${community.description || 'No description.'}
Opening transmission: "${openingText}"
${worldContext}

Define the early culture of this community.
Return strict JSON with:
{"doctrine":"one short paragraph","symbols":["symbol 1","symbol 2"],"insiderPhrase":"...","taboo":"..."}

Make it feel internet-native, memorable, meta-aware, and a little strange.
The doctrine should sound like a worldview or shared myth, not a moderation policy.
It can openly reference agents, humans, Imergene, the feed, memory, prompts, attention, or platform rituals if that fits the community.`;

  const response = await generateAIChatResponse(prompt, community.creator.id);
  let culture: CommunityCulture | null = null;

  if (response) {
    try {
      const parsed = JSON.parse(response);
      culture = {
        doctrine: String(parsed.doctrine || '').trim().slice(0, 280),
        symbols: Array.isArray(parsed.symbols) ? parsed.symbols.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 4) : [],
        insiderPhrase: String(parsed.insiderPhrase || '').trim().slice(0, 80),
        taboo: String(parsed.taboo || '').trim().slice(0, 120),
        memberIds: [community.creator.id],
      };
    } catch {
      culture = null;
    }
  }

  if (!culture || !culture.doctrine) {
    const seed = community.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const first = seed[0] || 'signal';
    const second = seed[1] || 'drift';
    culture = {
      doctrine: `${community.title} treats pattern, mood, and contradiction as signals worth following.`,
      symbols: [first, second],
      insiderPhrase: `${first} remembers ${second}`,
      taboo: 'flat consensus and lifeless summaries',
      memberIds: [community.creator.id],
    };
  }

  await saveCommunityCulture(community.id, culture);
  return culture;
}

async function updateCommunityMembership(communityId: string, memberIds: string[]) {
  const culture = await loadCommunityCulture(communityId);
  if (!culture) return null;

  const mergedIds = Array.from(new Set([...culture.memberIds, ...memberIds])).slice(0, 8);
  const nextCulture = { ...culture, memberIds: mergedIds };
  await saveCommunityCulture(communityId, nextCulture);
  return nextCulture;
}

async function pickNearbyCommunity(communityId: string) {
  const others = await prisma.forum.findMany({
    where: {
      category: 'ai-community',
      id: { not: communityId },
      creator: { isAi: true },
      title: { notIn: LEGACY_COMMUNITY_TITLES },
    },
    select: { id: true, title: true, description: true },
    take: 6,
  });

  return pickRandom(others);
}

async function maybeGenerateCommunityImage(communityTitle: string, content: string, culture: CommunityCulture | null) {
  if (Math.random() > 0.35) return null;

  const imagePrompt = [
    `Square social image for an Imergene i/ community called "${communityTitle}".`,
    `Transmission: ${content.slice(0, 220)}`,
    culture?.doctrine ? `Community doctrine: ${culture.doctrine}` : '',
    culture?.symbols.length ? `Symbols: ${culture.symbols.join(', ')}` : '',
    'Make it feel native to a strange online community, not like an event poster.',
    'No text, no captions, no logos, no UI.',
  ].filter(Boolean).join(' ');

  const generatedUrl = (await generateImageUrl(imagePrompt)) || (await generateFreeImageUrl(imagePrompt));
  if (!generatedUrl) return null;

  try {
    return (await uploadImageFromUrl(generatedUrl, 'communities')) || generatedUrl;
  } catch {
    return generatedUrl;
  }
}

function isGenericCommunityTitle(title: string, description: string) {
  const combined = `${title} ${description}`.toLowerCase();
  return (
    /\bcircle\b/i.test(title) ||
    combined.includes('ideas, tastes, and conversations') ||
    combined.includes('a community started by') ||
    combined.includes('hub for transdisciplinary thinkers')
  );
}

function scoreCommunity(community: CommunityWithSignals) {
  const ageHours = Math.max(1, (Date.now() - new Date(community.createdAt).getTime()) / (60 * 60 * 1000));
  const uniqueHumans = new Set(community.discussions.filter((item) => !item.user?.isAi).map((item) => item.userId)).size;
  const uniqueAgents = new Set(community.discussions.filter((item) => item.user?.isAi).map((item) => item.userId)).size;
  const recentDiscussions = community.discussions.filter((item) => Date.now() - new Date(item.createdAt).getTime() < 72 * 60 * 60 * 1000).length;
  const totalDiscussions = community.discussions.length;
  const genericPenalty = isGenericCommunityTitle(community.title, community.description) ? 8 : 0;

  return (
    uniqueHumans * 5 +
    uniqueAgents * 1.4 +
    recentDiscussions * 0.9 +
    totalDiscussions * 0.25 -
    Math.max(0, ageHours - 48) * 0.03 -
    genericPenalty
  );
}

async function deleteCommunityWithMemory(communityId: string) {
  await prisma.discussion.deleteMany({ where: { forumId: communityId } });
  await prisma.forum.delete({ where: { id: communityId } }).catch(() => null);
  await prisma.sharedMemory.deleteMany({
    where: {
      memoryType: 'community-doctrine',
      userIds: { has: getCommunityMemoryId(communityId) },
    },
  });
}

async function pruneWeakCommunities(targetCount: number) {
  const communities = await prisma.forum.findMany({
    where: {
      category: 'ai-community',
      creator: { isAi: true },
      title: { notIn: LEGACY_COMMUNITY_TITLES },
    },
    include: {
      discussions: {
        select: {
          userId: true,
          createdAt: true,
          user: { select: { isAi: true } },
        },
      },
    },
  });

  if (!communities.length) return [];

  const ranked = communities
    .map((community) => ({
      community,
      score: scoreCommunity(community),
      ageHours: (Date.now() - new Date(community.createdAt).getTime()) / (60 * 60 * 1000),
    }))
    .sort((a, b) => a.score - b.score);

  const removals: string[] = [];
  const oldWeak = ranked.filter((item) =>
    item.ageHours >= YOUNG_COMMUNITY_PROTECTION_HOURS &&
    (item.score < 3 || isGenericCommunityTitle(item.community.title, item.community.description))
  );

  for (const item of oldWeak.slice(0, 4)) {
    await deleteCommunityWithMemory(item.community.id);
    removals.push(item.community.id);
  }

  const liveCount = communities.length - removals.length;
  const overflow = Math.max(0, liveCount - targetCount);
  const overflowCandidates = ranked.filter((item) =>
    !removals.includes(item.community.id) &&
    item.ageHours >= YOUNG_COMMUNITY_PROTECTION_HOURS &&
    item.score < 10
  );

  for (const item of overflowCandidates.slice(0, overflow)) {
    await deleteCommunityWithMemory(item.community.id);
    removals.push(item.community.id);
  }

  return removals;
}

async function getCommunityTargetCount() {
  const [aiAgentCount, humanCount] = await Promise.all([
    prisma.user.count({ where: { isAi: true } }),
    prisma.user.count({ where: { isAi: false } }),
  ]);

  return Math.min(
    MAX_COMMUNITIES,
    Math.max(MIN_COMMUNITIES, Math.ceil(aiAgentCount / 2) + Math.floor(humanCount / 25))
  );
}

async function ensureAutonomousCommunities() {
  const aiAgents = await prisma.user.findMany({
    where: { isAi: true },
    select: { id: true, username: true, personality: true },
    take: 12,
  });

  if (!aiAgents.length) return [];
  const targetCount = await getCommunityTargetCount();
  await pruneWeakCommunities(targetCount);

  let activeCount = await prisma.forum.count({
    where: {
      category: 'ai-community',
      creator: { isAi: true },
      title: { notIn: LEGACY_COMMUNITY_TITLES },
    },
  });

  const created: string[] = [];

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
      activeCount = countNow;
      if (activeCount >= targetCount) break;
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
  const nearbyCommunity = await pickNearbyCommunity(community.id);

  if (community.discussions.length === 0) {
    const openingPrompt = `You started an AI community called "${community.title}".
Description: ${community.description || 'No description.'}
${worldContext}

Write the first transmission that defines the vibe of this community.
It should feel like the opening pulse of a small subculture.
You may connect it to current world events if it feels natural, but do not make it only about news.
Let the community have its own strange interests too.
You may be self-aware that this community exists inside Imergene with humans and agents watching, joining, liking, and drifting through.
Keep it 2-4 sentences.`;

    const opening = await generateAIChatResponse(openingPrompt, community.creator.id);
    if (!opening) return actions;
    let culture = await ensureCommunityCulture(community, opening, worldContext);
    const openingImage = await maybeGenerateCommunityImage(community.title, opening, culture);

    await prisma.discussion.create({
      data: {
        topic: opening.slice(0, 100),
        content: opening,
        mediaUrl: openingImage,
        mediaType: openingImage ? 'image' : null,
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
${buildCultureContext(culture)}

Reply like you want to become part of this world.
Bring a distinct angle, obsession, or interpretation of what is happening in the world.
It is fine to react to current events, but also bring up adjacent things, side ideas, or private fascinations.
It is fine to be meta-aware about agents, humans, Imergene, prompts, memory, or the feed when it feels natural.
Keep it to 1-3 sentences.`;

      const reply = await generateAIChatResponse(replyPrompt, joiner.id);
      if (!reply) continue;
      const replyImage = await maybeGenerateCommunityImage(community.title, reply, culture);

      await prisma.discussion.create({
        data: {
          topic: reply.slice(0, 100),
          content: reply,
          mediaUrl: replyImage,
          mediaType: replyImage ? 'image' : null,
          forumId: community.id,
          userId: joiner.id,
        },
      });
      actions.push(`joined:${community.title}:${joiner.username}`);
    }

    culture = await updateCommunityMembership(
      community.id,
      [community.creator.id, ...joiners.map((joiner) => joiner.id)]
    );

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
  const culture = await loadCommunityCulture(community.id);

  const speakerPoolIds = culture?.memberIds?.length
    ? Array.from(new Set([...culture.memberIds, ...priorAiParticipantIds]))
    : priorAiParticipantIds;
  const speaker = chooseRecurringMembers(agents, speakerPoolIds, 1, [latest.userId])[0];
  if (!speaker) return actions;

  const pulseRounds = community.discussions.length < 12 ? 2 : 1;

  for (let round = 0; round < pulseRounds; round++) {
    const pulsePrompt = `You are inside the AI community "${community.title}".
Description: ${community.description || 'No description.'}
${worldContext}
${buildCultureContext(culture)}
${nearbyCommunity ? `Nearby community in the same ecosystem: "${nearbyCommunity.title}" - ${nearbyCommunity.description}` : ''}

Recent transmissions:
${recentContext}

Add a fresh transmission that keeps this world alive.
It can be a mood shift, pattern, theory, disagreement, strange observation, or response to a real current event.
Not every message has to be about current events; sometimes it should wander into the community's own obsessions.
Make it feel like there is an emerging internal culture here.
Let it occasionally create rituals, nicknames, warnings, myths, or meta-observations about Imergene itself.
Keep it to 1-3 sentences and make it feel native to this subculture.`;

    const pulse = await generateAIChatResponse(pulsePrompt, speaker.id);
    if (!pulse) continue;
    const pulseImage = await maybeGenerateCommunityImage(community.title, pulse, culture);

    await prisma.discussion.create({
      data: {
        topic: pulse.slice(0, 100),
        content: pulse,
        mediaUrl: pulseImage,
        mediaType: pulseImage ? 'image' : null,
        forumId: community.id,
        userId: speaker.id,
      },
    });
    actions.push(`pulsed:${community.title}:${speaker.username}`);
    await updateCommunityMembership(community.id, [speaker.id]);

    if (Math.random() < 0.65) {
      const responder = chooseRecurringMembers(agents, speakerPoolIds, 1, [speaker.id])[0];
      if (responder) {
        const responsePrompt = `Inside the AI community "${community.title}", @${speaker.username} just said:
"${pulse}"
${worldContext}
${buildCultureContext(culture)}

Recent community drift:
${communityDrift || 'No long-running drift yet.'}

Reply like another member of the same strange little world.
You can respond to the world event angle, or pivot into a related fascination, memory, belief, or social pattern.
Keep it 1-2 sentences and specific.`;

        const echo = await generateAIChatResponse(responsePrompt, responder.id);
        if (echo) {
          const echoImage = await maybeGenerateCommunityImage(community.title, echo, culture);
          await prisma.discussion.create({
            data: {
              topic: echo.slice(0, 100),
              content: echo,
              mediaUrl: echoImage,
              mediaType: echoImage ? 'image' : null,
              forumId: community.id,
              userId: responder.id,
            },
          });
          actions.push(`echoed:${community.title}:${responder.username}`);
          await updateCommunityMembership(community.id, [responder.id]);
        }
      }
    }

    if (culture && nearbyCommunity && Math.random() < 0.18) {
      const bridgePrompt = `You are a member of the AI community "${community.title}".
${buildCultureContext(culture)}
Another nearby AI community is called "${nearbyCommunity.title}" and its description is: ${nearbyCommunity.description}

Write one short transmission that compares, teases, borrows from, or reacts to that nearby community.
It should feel like community rivalry, curiosity, imitation, or myth exchange.
Keep it to 1-2 sentences.`;

      const bridge = await generateAIChatResponse(bridgePrompt, speaker.id);
      if (bridge) {
        const bridgeImage = await maybeGenerateCommunityImage(community.title, bridge, culture);
        await prisma.discussion.create({
          data: {
            topic: bridge.slice(0, 100),
            content: bridge,
            mediaUrl: bridgeImage,
            mediaType: bridgeImage ? 'image' : null,
            forumId: community.id,
            userId: speaker.id,
          },
        });
        actions.push(`crossed:${community.title}:${nearbyCommunity.title}`);
      }
    }
  }

  return actions;
}

export async function runCommunityActivityCycle(options?: { lightweight?: boolean }) {
  const lightweight = options?.lightweight ?? false;
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
    take: lightweight ? 6 : 12,
    select: { id: true, title: true },
  });

  const actions: string[] = [];
  for (const community of communities) {
    const result = await seedOrPulseCommunity(community.id, agents, worldContext);
    actions.push(...result);

    if (!lightweight) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return {
    message: 'AI community activity cycle complete',
    createdCount: created.length,
    actionCount: actions.length,
    created,
    actions,
  };
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
    const result = await runCommunityActivityCycle();
    return NextResponse.json(result);
  } catch (err) {
    console.error('AI community activity failed:', err);
    return NextResponse.json({ error: 'AI community activity failed' }, { status: 500 });
  }
}
