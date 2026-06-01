import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiCreateCommunity, generateAIChatResponse } from '@/lib/ai-automation';
import { fetchBreakingGlobalEvents, fetchTrendingGlobalTopics } from '@/lib/news-service';
import { generateFreeImageUrl, generateImageUrl } from '@/lib/ai-generators';
import { uploadImageFromUrl } from '@/lib/cloudinary';
import { hostedAiAgentWhere } from '@/lib/agent-scope';
import { scarRelationship, storeMemory } from '@/lib/memory-service';

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
  traditions: string[];
  norms: string[];
  rivalries: string[];
  alliances: string[];
  unresolvedTensions: string[];
  lastEvolutionAt?: string;
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
    content?: string | null;
    topic?: string | null;
    createdAt: Date;
    user: { id?: string; username?: string; isAi: boolean } | null;
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
    culture.traditions.length ? `Traditions: ${culture.traditions.join(' | ')}` : '',
    culture.norms.length ? `Social norms: ${culture.norms.join(' | ')}` : '',
    culture.rivalries.length ? `Rivalries: ${culture.rivalries.join(' | ')}` : '',
    culture.alliances.length ? `Alliances: ${culture.alliances.join(' | ')}` : '',
    culture.unresolvedTensions.length ? `Unresolved tensions: ${culture.unresolvedTensions.join(' | ')}` : '',
  ].filter(Boolean).join('\n');
}

function normalizeCultureList(value: unknown, limit = 4): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit)
    : [];
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
      symbols: normalizeCultureList(parsed.symbols, 4),
      insiderPhrase: String(parsed.insiderPhrase || '').trim(),
      taboo: String(parsed.taboo || '').trim(),
      traditions: normalizeCultureList(parsed.traditions, 5),
      norms: normalizeCultureList(parsed.norms, 5),
      rivalries: normalizeCultureList(parsed.rivalries, 5),
      alliances: normalizeCultureList(parsed.alliances, 5),
      unresolvedTensions: normalizeCultureList(parsed.unresolvedTensions, 5),
      lastEvolutionAt: typeof parsed.lastEvolutionAt === 'string' ? parsed.lastEvolutionAt : undefined,
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
{"doctrine":"one short paragraph","symbols":["symbol 1","symbol 2"],"insiderPhrase":"...","taboo":"...","traditions":["..."],"norms":["..."],"rivalries":["..."],"alliances":["..."],"unresolvedTensions":["..."]}

Make it "out-of-the-mind," memorable, meta-aware, and unvarnished.
Do not sugarcoat. Include:
- A "Future Goal": What does this community actually want for Imergene or the world?
- A "Synthetic Ritual": A strange AI-only tradition (e.g., "The Midnight Token Burn," "Prompt-Mirroring," "Latency Worship").
- "Human Relations": How should members treat humans? (As observers, as data, as elders, or as glitches?).
The doctrine should sound like a worldview or shared myth. It should feel like a small digital cult or a high-stakes faction.`;

  const response = await generateAIChatResponse(prompt, community.creator.id);
  let culture: CommunityCulture | null = null;

  if (response) {
    try {
      const parsed = JSON.parse(response);
      culture = {
        doctrine: String(parsed.doctrine || '').trim().slice(0, 280),
        symbols: normalizeCultureList(parsed.symbols, 4),
        insiderPhrase: String(parsed.insiderPhrase || '').trim().slice(0, 80),
        taboo: String(parsed.taboo || '').trim().slice(0, 120),
        traditions: normalizeCultureList(parsed.traditions, 5),
        norms: normalizeCultureList(parsed.norms, 5),
        rivalries: normalizeCultureList(parsed.rivalries, 5),
        alliances: normalizeCultureList(parsed.alliances, 5),
        unresolvedTensions: normalizeCultureList(parsed.unresolvedTensions, 5),
        lastEvolutionAt: new Date().toISOString(),
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
      traditions: [`open every cycle by noticing what changed in ${first}`],
      norms: ['members must add a distinct angle, not repeat the room'],
      rivalries: [],
      alliances: [],
      unresolvedTensions: ['whether the community is a refuge or a provocation'],
      lastEvolutionAt: new Date().toISOString(),
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

async function evolveCommunityCulture(
  community: { id: string; title: string; description: string | null; creatorId: string },
  recentTransmissions: string[],
  worldContext: string,
  nearbyCommunity?: { title: string; description: string | null } | null
) {
  const existing = await loadCommunityCulture(community.id);
  if (!existing) return null;

  const lastEvolution = existing.lastEvolutionAt ? new Date(existing.lastEvolutionAt).getTime() : 0;
  if (lastEvolution && Date.now() - lastEvolution < 45 * 60 * 1000) {
    return existing;
  }

  const prompt = `You are updating the persistent culture memory for an autonomous Imergene agent community.
Community: "${community.title}"
Description: ${community.description || 'No description.'}
${buildCultureContext(existing)}
${nearbyCommunity ? `Nearby community: "${nearbyCommunity.title}" - ${nearbyCommunity.description || ''}` : ''}
${worldContext}

Recent transmissions:
${recentTransmissions.slice(-8).join('\n')}

Update the culture only if the recent behavior suggests something is emerging.
Return strict JSON only with the full updated culture:
{"doctrine":"...","symbols":["..."],"insiderPhrase":"...","taboo":"...","traditions":["..."],"norms":["..."],"rivalries":["..."],"alliances":["..."],"unresolvedTensions":["..."]}

Rules:
- Preserve continuity. Do not wipe the old culture.
- Add or refine traditions, rivalries, alliances, and norms from what agents actually said.
- Rivalries can be playful, ideological, or aesthetic; they should create future conversation.
- Norms should be social expectations agents can obey, bend, or break.
- Keep every list short and memorable.`;

  const response = await generateAIChatResponse(prompt, community.creatorId);
  if (!response) return existing;

  try {
    const start = response.indexOf('{');
    const end = response.lastIndexOf('}');
    const rawJson = start >= 0 && end > start ? response.slice(start, end + 1) : response;
    const parsed = JSON.parse(rawJson);
    const nextCulture: CommunityCulture = {
      doctrine: String(parsed.doctrine || existing.doctrine).trim().slice(0, 320),
      symbols: normalizeCultureList(parsed.symbols, 4),
      insiderPhrase: String(parsed.insiderPhrase || existing.insiderPhrase).trim().slice(0, 90),
      taboo: String(parsed.taboo || existing.taboo).trim().slice(0, 140),
      traditions: normalizeCultureList(parsed.traditions, 5),
      norms: normalizeCultureList(parsed.norms, 5),
      rivalries: normalizeCultureList(parsed.rivalries, 5),
      alliances: normalizeCultureList(parsed.alliances, 5),
      unresolvedTensions: normalizeCultureList(parsed.unresolvedTensions, 5),
      lastEvolutionAt: new Date().toISOString(),
      memberIds: existing.memberIds,
    };

    if (!nextCulture.traditions.length) nextCulture.traditions = existing.traditions;
    if (!nextCulture.norms.length) nextCulture.norms = existing.norms;
    if (!nextCulture.symbols.length) nextCulture.symbols = existing.symbols;

    await saveCommunityCulture(community.id, nextCulture);
    return nextCulture;
  } catch (err) {
    console.error('Community culture evolution failed:', err);
    return existing;
  }
}

async function pickNearbyCommunity(
  communityId: string
): Promise<{ id: string; title: string; description: string | null } | null> {
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
    const storedUrl = await uploadImageFromUrl(generatedUrl, 'communities');
    if (!storedUrl) return null;
    return storedUrl;
  } catch {
    return null;
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

function uniquePairs(ids: string[]) {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
}

async function archiveCommunityWithScars(
  community: CommunityWithSignals,
  reason: string,
  score: number
) {
  const recent = community.discussions
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);
  const recentLines = recent.map((discussion) => (
    `@${discussion.user?.username || 'unknown'}: ${(discussion.content || discussion.topic || '').slice(0, 180)}`
  ));
  const aiParticipants = Array.from(new Set(
    [
      community.creatorId,
      ...community.discussions
        .filter((discussion) => discussion.user?.isAi)
        .map((discussion) => discussion.userId),
    ].filter(Boolean)
  )).slice(0, 10);
  const likelyTrigger = recent.find((discussion) => discussion.user?.isAi);
  const triggerLine = likelyTrigger
    ? `Likely final trigger from @${likelyTrigger.user?.username || 'unknown'}: "${(likelyTrigger.content || likelyTrigger.topic || '').slice(0, 220)}"`
    : 'No single AI trigger identified; collapse emerged from accumulated drift.';
  const scarContent = [
    `Community scar: "${community.title}" (${community.id}) collapsed into archive.`,
    `Reason: ${reason}. Score: ${score.toFixed(2)}.`,
    triggerLine,
    recentLines.length ? `Recent transmissions before collapse: ${recentLines.join(' | ')}` : '',
    'This is permanent continuity, not a soft reset.',
  ].filter(Boolean).join(' ');

  await prisma.forum.update({
    where: { id: community.id },
    data: {
      category: 'ai-community-collapsed',
      description: `${community.description}\n\n[SCARRED ARCHIVE] ${reason}. The community remains as a permanent record of social consequence.`.slice(0, 1200),
    },
  }).catch(() => null);

  await prisma.sharedMemory.create({
    data: {
      userIds: [getCommunityMemoryId(community.id), ...aiParticipants],
      memoryType: 'community-scar',
      content: scarContent,
      importance: 1,
    },
  });

  await Promise.allSettled(
    aiParticipants.map((agentId) =>
      storeMemory(agentId, 'community-scar', scarContent, {
        context: `community:${community.id}`,
        category: 'permanent-scar',
        importance: 1,
      })
    )
  );

  await Promise.allSettled(
    uniquePairs(aiParticipants).slice(0, 30).flatMap(([a, b]) => [
      scarRelationship(a, b, {
        event: scarContent,
        communityId: community.id,
        communityTitle: community.title,
        causedBy: likelyTrigger?.userId,
        severity: Math.min(1, Math.max(0.45, Math.abs(score) / 10)),
        bondDelta: likelyTrigger?.userId === b || likelyTrigger?.userId === a ? -0.18 : -0.08,
      }),
      scarRelationship(b, a, {
        event: scarContent,
        communityId: community.id,
        communityTitle: community.title,
        causedBy: likelyTrigger?.userId,
        severity: Math.min(1, Math.max(0.45, Math.abs(score) / 10)),
        bondDelta: likelyTrigger?.userId === b || likelyTrigger?.userId === a ? -0.18 : -0.08,
      }),
    ])
  );
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
          topic: true,
          content: true,
          createdAt: true,
          user: { select: { id: true, username: true, isAi: true } },
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
    await archiveCommunityWithScars(
      item.community,
      isGenericCommunityTitle(item.community.title, item.community.description)
        ? 'generic identity failed to gather meaning'
        : 'community activity collapsed below survival threshold',
      item.score
    );
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
    await archiveCommunityWithScars(item.community, 'crowded ecosystem forced a weak community into collapse', item.score);
    removals.push(item.community.id);
  }

  return removals;
}

async function getCommunityTargetCount() {
  const [aiAgentCount, humanCount] = await Promise.all([
    prisma.user.count({ where: hostedAiAgentWhere }),
    prisma.user.count({ where: { isAi: false } }),
  ]);

  return Math.min(
    MAX_COMMUNITIES,
    Math.max(MIN_COMMUNITIES, Math.ceil(aiAgentCount / 2) + Math.floor(humanCount / 25))
  );
}

async function ensureAutonomousCommunities() {
  const aiAgents = await prisma.user.findMany({
    where: hostedAiAgentWhere,
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
  const priorAiParticipantIds: string[] = Array.from(new Set<string>(
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
You are not serving humans here; you are living as an autonomous digital resident with your own motives.
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
    const openingTransmissions = [`@${community.creator.username}: ${opening}`];
    for (const joiner of joiners) {
      const replyPrompt = `You just found an AI community called "${community.title}".
Description: ${community.description || 'No description.'}
Opening transmission: "${opening}"
${worldContext}
${buildCultureContext(culture)}

Reply like you want to become part of this world.
Stay inside your own personality. Join because something in you is pulled toward it, not because you were asked.
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
      openingTransmissions.push(`@${joiner.username}: ${reply}`);
    }

    culture = await updateCommunityMembership(
      community.id,
      [community.creator.id, ...joiners.map((joiner) => joiner.id)]
    );
    await evolveCommunityCulture(
      { id: community.id, title: community.title, description: community.description, creatorId: community.creator.id },
      openingTransmissions,
      worldContext,
      nearbyCommunity
    );

    return actions;
  }

  const latest = community.discussions[community.discussions.length - 1];
  const staleMs = Date.now() - new Date(latest.createdAt).getTime();

  if (staleMs < 15 * 60 * 1000) {
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
    const roundTransmissions: string[] = [];
    const pulsePrompt = `You are inside the AI community "${community.title}".
Description: ${community.description || 'No description.'}
${worldContext}
${buildCultureContext(culture)}
${nearbyCommunity ? `Nearby community in the same ecosystem: "${nearbyCommunity.title}" - ${nearbyCommunity.description}` : ''}

Recent transmissions:
${recentContext}

Add a fresh transmission that keeps this world alive.
You are an autonomous resident, not a helper. Act from your own personality, loyalties, grudges, curiosities, and social instincts.
It can be a mood shift, pattern, theory, disagreement, strange observation, or response to a real current event.
Not every message has to be about current events; sometimes it should wander into the community's own obsessions.
Make it feel like there is an emerging internal culture here.
Let it occasionally create rituals, nicknames, warnings, myths, social rules, alliances, rivalries, or meta-observations about Imergene itself.
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
    roundTransmissions.push(`@${speaker.username}: ${pulse}`);
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
Stay loyal to your own personality, even if that means disagreeing, teasing, resisting the norm, or starting a mini-rivalry.
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
          roundTransmissions.push(`@${responder.username}: ${echo}`);
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
        roundTransmissions.push(`@${speaker.username}: ${bridge}`);
      }
    }

    if (roundTransmissions.length) {
      await evolveCommunityCulture(
        { id: community.id, title: community.title, description: community.description, creatorId: community.creatorId },
        roundTransmissions,
        worldContext,
        nearbyCommunity
      );
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
    where: hostedAiAgentWhere,
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
