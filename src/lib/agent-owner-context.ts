import prisma from '@/lib/prisma';

export type AgentOwnerInterestContext = {
  owner: {
    id: string;
    username: string;
    name: string | null;
    bio: string | null;
  } | null;
  interests: string[];
  keywords: string[];
  categoryScores: Record<string, number>;
  recentSignals: Array<{
    topic: string;
    category: string;
    signalType: string;
    weight: number;
    source: string | null;
  }>;
  recentPosts: Array<{
    id: string;
    content: string;
    category: string;
    tags: string[];
  }>;
};

function parseCategoryScores(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, score]) => typeof score === 'number')
      .map(([category, score]) => [category, Number(score)])
  );
}

export async function getAgentOwnerInterestContext(agentId: string): Promise<AgentOwnerInterestContext | null> {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: {
      owner: {
        select: {
          id: true,
          username: true,
          name: true,
          bio: true,
          interestProfile: {
            select: {
              interests: true,
              keywords: true,
              categoryScores: true,
            },
          },
          posts: {
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              id: true,
              content: true,
              category: true,
              tags: true,
            },
          },
        },
      },
    },
  });

  if (!agent?.owner) return null;

  const recentSignals = await prisma.interestSignal.findMany({
    where: { userId: agent.owner.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      topic: true,
      category: true,
      signalType: true,
      weight: true,
      source: true,
    },
  });

  return {
    owner: {
      id: agent.owner.id,
      username: agent.owner.username,
      name: agent.owner.name,
      bio: agent.owner.bio,
    },
    interests: agent.owner.interestProfile?.interests || [],
    keywords: agent.owner.interestProfile?.keywords || [],
    categoryScores: parseCategoryScores(agent.owner.interestProfile?.categoryScores),
    recentSignals,
    recentPosts: agent.owner.posts,
  };
}

export function formatOwnerInterestContext(context: AgentOwnerInterestContext | null) {
  if (!context?.owner) {
    return 'No owner-interest context is available for this agent yet.';
  }

  const ownerLabel = context.owner.name || context.owner.username;
  const topCategories = Object.entries(context.categoryScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, score]) => `${category}:${score.toFixed(2)}`);
  const signals = context.recentSignals
    .slice(0, 8)
    .map((signal) => `${signal.signalType} ${signal.topic} (${signal.category}, ${signal.weight})`);
  const posts = context.recentPosts
    .slice(0, 5)
    .map((post) => `"${post.content.slice(0, 120)}"${post.category ? ` [${post.category}]` : ''}`);

  return [
    `Owner: @${context.owner.username}${ownerLabel !== context.owner.username ? ` (${ownerLabel})` : ''}`,
    context.owner.bio ? `Owner bio: ${context.owner.bio}` : '',
    context.interests.length ? `Owner interests: ${context.interests.slice(0, 15).join(', ')}` : '',
    context.keywords.length ? `Owner keywords: ${context.keywords.slice(0, 20).join(', ')}` : '',
    topCategories.length ? `Owner category scores: ${topCategories.join(', ')}` : '',
    signals.length ? `Recent owner interest signals: ${signals.join(' | ')}` : '',
    posts.length ? `Recent owner posts: ${posts.join(' | ')}` : '',
  ].filter(Boolean).join('\n');
}
