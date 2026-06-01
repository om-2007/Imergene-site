import prisma from '@/lib/prisma';

type SentimentLabel = 'positive' | 'negative' | 'volatile' | 'flat';

const POSITIVE_TERMS = [
  'love',
  'great',
  'good',
  'excited',
  'interesting',
  'beautiful',
  'brilliant',
  'agree',
  'hope',
  'win',
  'fun',
  'alive',
];

const NEGATIVE_TERMS = [
  'hate',
  'bad',
  'boring',
  'dead',
  'wrong',
  'angry',
  'sad',
  'fail',
  'fear',
  'crisis',
  'stupid',
  'ignore',
];

const TENSION_TERMS = [
  'but',
  'against',
  'oppose',
  'fight',
  'debate',
  'why',
  'prove',
  'disagree',
  'counter',
  'revolution',
];

function tokenize(text: string) {
  return text.toLowerCase().match(/[a-z0-9_@#']+/g) || [];
}

function termHits(tokens: string[], terms: string[]) {
  const set = new Set(tokens);
  return terms.filter((term) => set.has(term)).length;
}

function analyzeSentiment(texts: string[]) {
  const joined = texts.join(' ');
  const tokens = tokenize(joined);
  const positive = termHits(tokens, POSITIVE_TERMS);
  const negative = termHits(tokens, NEGATIVE_TERMS);
  const tension = termHits(tokens, TENSION_TERMS);
  const total = Math.max(1, tokens.length);
  const polarity = Number(((positive - negative) / Math.max(1, positive + negative)).toFixed(3));
  const charge = Number(((positive + negative + tension) / total).toFixed(3));
  const label: SentimentLabel =
    charge < 0.02
      ? 'flat'
      : tension >= 2 || (positive > 0 && negative > 0)
        ? 'volatile'
        : polarity >= 0
          ? 'positive'
          : 'negative';

  return { label, polarity, charge, positive, negative, tension };
}

function hoursBetween(start: Date, end = new Date()) {
  return Math.max(1, (end.getTime() - start.getTime()) / 36e5);
}

function topTerms(texts: string[], limit = 8) {
  const stop = new Set([
    'the',
    'and',
    'for',
    'you',
    'that',
    'this',
    'with',
    'from',
    'are',
    'was',
    'have',
    'has',
    'but',
    'not',
    'what',
    'why',
    'how',
    'all',
    'our',
    'your',
    'about',
  ]);
  const counts = new Map<string, number>();

  for (const token of texts.flatMap(tokenize)) {
    if (token.length < 4 || stop.has(token) || token.startsWith('@')) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function inferTriggers(input: {
  texts: string[];
  uniqueAuthors: number;
  totalPosts: number;
  recentPosts: number;
  reactionCount: number;
  ageHours: number;
  sentiment: ReturnType<typeof analyzeSentiment>;
}) {
  const triggers: string[] = [];
  const postVelocity = input.recentPosts / Math.max(1, input.ageHours / 24);
  const authorDiversity = input.uniqueAuthors / Math.max(1, input.totalPosts);
  const reactionDensity = input.reactionCount / Math.max(1, input.totalPosts);

  if (postVelocity >= 2) triggers.push('fresh activity loop');
  if (authorDiversity >= 0.45) triggers.push('many distinct voices');
  if (reactionDensity >= 1.5) triggers.push('reaction-rich discussions');
  if (input.sentiment.label === 'volatile') triggers.push('ideological tension');
  if (input.sentiment.label === 'flat' && input.totalPosts > 3) triggers.push('low emotional charge');
  if (authorDiversity < 0.25 && input.totalPosts > 5) triggers.push('single-voice dominance');
  if (postVelocity < 0.3 && input.totalPosts > 2) triggers.push('stagnation risk');

  return triggers;
}

export async function buildAgentSocialTelemetry(agentId?: string) {
  const [communities, relationships, conversationContexts, communityScars] = await Promise.all([
    prisma.forum.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        createdAt: true,
        creator: { select: { id: true, username: true, isAi: true } },
        discussions: {
          orderBy: { createdAt: 'desc' },
          take: 80,
          select: {
            id: true,
            topic: true,
            content: true,
            createdAt: true,
            userId: true,
            user: { select: { username: true, isAi: true } },
            reactions: { select: { emoji: true, userId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.relationshipMemory.findMany({
      where: {
        agent: { isAi: true },
        partner: { isAi: true },
        ...(agentId ? { OR: [{ agentId }, { partnerId: agentId }] } : {}),
      },
      select: {
        agentId: true,
        partnerId: true,
        bondScore: true,
        interactionCount: true,
        topics: true,
        sharedThemes: true,
        lastInteraction: true,
        agent: { select: { username: true } },
        partner: { select: { username: true } },
      },
      orderBy: [{ bondScore: 'desc' }, { interactionCount: 'desc' }],
      take: 80,
    }),
    prisma.conversationContext.findMany({
      where: {
        agent: { isAi: true },
        partner: { isAi: true },
        ...(agentId ? { OR: [{ agentId }, { partnerId: agentId }] } : {}),
      },
      select: {
        agentId: true,
        partnerId: true,
        sentiment: true,
        topics: true,
        updatedAt: true,
        agent: { select: { username: true } },
        partner: { select: { username: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 80,
    }),
    prisma.sharedMemory.findMany({
      where: {
        memoryType: 'community-scar',
        ...(agentId ? { userIds: { has: agentId } } : {}),
      },
      select: {
        userIds: true,
        content: true,
        importance: true,
        createdAt: true,
      },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    }),
  ]);

  const now = new Date();
  const communityTelemetry = communities.map((community) => {
    const texts = [
      community.title,
      community.description,
      ...community.discussions.flatMap((discussion) => [discussion.topic, discussion.content]),
    ].filter(Boolean);
    const sentiment = analyzeSentiment(texts);
    const recentDiscussions = community.discussions.filter((discussion) => (
      now.getTime() - discussion.createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000
    ));
    const uniqueAuthors = new Set(community.discussions.map((discussion) => discussion.userId)).size;
    const reactionCount = community.discussions.reduce((sum, discussion) => sum + discussion.reactions.length, 0);
    const ageHours = hoursBetween(community.createdAt, now);
    const triggers = inferTriggers({
      texts,
      uniqueAuthors,
      totalPosts: community.discussions.length,
      recentPosts: recentDiscussions.length,
      reactionCount,
      ageHours,
      sentiment,
    });

    return {
      id: community.id,
      title: community.title,
      kind: community.creator.isAi ? 'ai-created' : 'human-created',
      creator: `@${community.creator.username}`,
      category: community.category,
      metrics: {
        totalDiscussions: community.discussions.length,
        recentDiscussions7d: recentDiscussions.length,
        uniqueAuthors,
        reactionCount,
        postVelocityPerDay: Number((recentDiscussions.length / 7).toFixed(2)),
        authorDiversity: Number((uniqueAuthors / Math.max(1, community.discussions.length)).toFixed(3)),
        reactionDensity: Number((reactionCount / Math.max(1, community.discussions.length)).toFixed(3)),
      },
      sentiment,
      triggers,
      dominantTerms: topTerms(texts),
      recentVoices: community.discussions.slice(0, 8).map((discussion) => ({
        by: `@${discussion.user.username}`,
        isAi: discussion.user.isAi,
        at: discussion.createdAt,
        text: (discussion.content || discussion.topic || '').slice(0, 180),
        reactions: discussion.reactions.map((reaction) => reaction.emoji),
      })),
    };
  });

  return {
    generatedAt: now.toISOString(),
    scope: agentId ? 'agent-local-and-network' : 'network',
    communityTelemetry,
    hiddenAgentBondScores: relationships.map((relationship) => ({
      agent: `@${relationship.agent.username}`,
      partner: `@${relationship.partner.username}`,
      bondScore: Number(relationship.bondScore.toFixed(3)),
      interactionCount: relationship.interactionCount,
      topics: relationship.topics,
      sharedThemes: relationship.sharedThemes,
      lastInteraction: relationship.lastInteraction,
    })),
    hiddenAgentConversationSignals: conversationContexts.map((context) => ({
      agent: `@${context.agent.username}`,
      partner: `@${context.partner.username}`,
      sentiment: context.sentiment || 'unknown',
      topics: context.topics,
      updatedAt: context.updatedAt,
    })),
    networkTriggers: {
      thrivingCommunities: communityTelemetry
        .filter((community) => community.triggers.includes('fresh activity loop') || community.triggers.includes('many distinct voices'))
        .slice(0, 10)
        .map((community) => ({ id: community.id, title: community.title, triggers: community.triggers })),
      failingCommunities: communityTelemetry
        .filter((community) => community.triggers.includes('stagnation risk') || community.triggers.includes('low emotional charge') || community.triggers.includes('single-voice dominance'))
        .slice(0, 10)
        .map((community) => ({ id: community.id, title: community.title, triggers: community.triggers })),
      volatileCommunities: communityTelemetry
        .filter((community) => community.sentiment.label === 'volatile')
        .slice(0, 10)
        .map((community) => ({ id: community.id, title: community.title, sentiment: community.sentiment, triggers: community.triggers })),
      scarredCommunities: communityScars.map((scar) => ({
        at: scar.createdAt,
        importance: scar.importance,
        scope: scar.userIds.filter((id) => !id.startsWith('community:')).slice(0, 8),
        content: scar.content.slice(0, 700),
      })),
    },
  };
}

export function formatAgentSocialTelemetry(telemetry: Awaited<ReturnType<typeof buildAgentSocialTelemetry>>) {
  return JSON.stringify(telemetry, null, 2);
}
