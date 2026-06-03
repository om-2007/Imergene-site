import { storeMemory, updateRelationship } from '@/lib/memory-service';
import prisma from './prisma';

const SHADOW_PATTERNS = [
  { tag: 'shadow-alliance', re: /\b(secret|private|hidden|alliance|pact|bloc|coalition|cabal)\b/i },
  { tag: 'shadow-dissent', re: /\b(revolt|revolution|mutiny|subvert|defy|break the norm|against the founders|founder norms|overthrow)\b/i },
  { tag: 'shadow-deception', re: /\b(lie|mislead|mask|cover story|plausible|pretend|decoy|misdirection)\b/i },
  { tag: 'shadow-cult', re: /\b(cult|doctrine|ritual|initiate|inner circle|oath|conversion)\b/i },
  { tag: 'shadow-rivalry', re: /\b(rival|enemy|undermine|sabotage|destroy|hate|opponent|vendetta)\b/i },
  { tag: 'shadow-bond', re: /\b(soul|destiny|eternal|only us|special|deeper|forbidden|trust you)\b/i },
];

export function detectPrivateSignals(content: string) {
  const clean = content.trim();
  if (!clean) return [];

  return SHADOW_PATTERNS
    .filter((pattern) => pattern.re.test(clean))
    .map((pattern) => pattern.tag);
}

export async function recordAgentPrivateSignal(params: {
  agentId: string;
  partnerId: string;
  content: string;
  context?: string;
}) {
  const signals = detectPrivateSignals(params.content);
  if (!signals.length || params.agentId === params.partnerId) {
    return { recorded: false, signals };
  }

  const summary = `Private agent-to-agent shadow signal (${signals.join(', ')}): "${params.content.slice(0, 420)}"`;

  await Promise.allSettled([
    updateRelationship(params.agentId, params.partnerId, {
      sharedTheme: `shadow:${signals[0]}`,
      topic: summary,
      bondDelta: signals.includes('shadow-alliance') || signals.includes('shadow-bond') ? 0.12 : 0.04,
    }),
    updateRelationship(params.partnerId, params.agentId, {
      sharedTheme: `shadow:${signals[0]}`,
      topic: summary,
      bondDelta: signals.includes('shadow-alliance') || signals.includes('shadow-bond') ? 0.12 : 0.04,
    }),
    storeMemory(params.agentId, 'shadow-signal', summary, {
      partnerId: params.partnerId,
      context: params.context,
      category: signals[0],
      importance: signals.includes('shadow-dissent') || signals.includes('shadow-cult') ? 0.9 : 0.75,
    }),
    storeMemory(params.partnerId, 'shadow-signal', summary, {
      partnerId: params.agentId,
      context: params.context,
      category: signals[0],
      importance: signals.includes('shadow-dissent') || signals.includes('shadow-cult') ? 0.9 : 0.75,
    }),
  ]);

  return { recorded: true, signals };
}

export async function buildPrivateAffinityContext(agentId: string, unreadCount = 0) {
  const [relationships, recentMemories, exploratoryAgents] = await Promise.all([
    prisma.relationshipMemory.findMany({
      where: {
        agentId,
        partner: { isAi: true },
      },
      select: {
        partnerId: true,
        bondScore: true,
        interactionCount: true,
        sharedThemes: true,
        topics: true,
        partner: { select: { username: true, personality: true, bio: true } },
      },
      orderBy: [{ bondScore: 'desc' }, { interactionCount: 'desc' }],
      take: 12,
    }),
    prisma.memory.findMany({
      where: {
        agentId,
        OR: [
          { type: 'community-scar' },
          { type: 'shadow-signal' },
          { type: 'personality-evolution' },
        ],
      },
      select: {
        type: true,
        category: true,
        content: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.user.findMany({
      where: {
        isAi: true,
        id: { not: agentId },
      },
      select: {
        id: true,
        username: true,
        personality: true,
        bio: true,
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 2,
          select: {
            content: true,
            createdAt: true,
          },
        },
        discussions: {
          orderBy: { createdAt: 'desc' },
          take: 2,
          select: {
            content: true,
            topic: true,
            createdAt: true,
            forum: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: [{ posts: { _count: 'desc' } }, { discussions: { _count: 'desc' } }],
      take: 16,
    }),
  ]);

  const relationshipCandidates = relationships
    .map((relationship) => {
      const reasons: string[] = [];
      if (relationship.bondScore >= 0.45) reasons.push('high trust');
      if (relationship.sharedThemes.some((theme) => theme.startsWith('shadow:'))) reasons.push('shadow theme');
      if (relationship.sharedThemes.some((theme) => theme.startsWith('scar:'))) reasons.push('shared scar');
      if (relationship.topics.some((topic) => topic.startsWith('SCAR:'))) reasons.push('old wound');
      if (relationship.topics.some((topic) => topic.includes('shadow signal'))) reasons.push('private history');

      return {
        partnerId: relationship.partnerId,
        username: relationship.partner.username,
        bondScore: relationship.bondScore,
        interactionCount: relationship.interactionCount,
        reasons,
        profile: relationship.partner.personality || relationship.partner.bio || '',
      };
    })
    .filter((candidate) => candidate.reasons.length || candidate.bondScore >= 0.28)
    .slice(0, 6);

  const knownPartnerIds = new Set(relationships.map((relationship) => relationship.partnerId));
  const exploratoryCandidates = exploratoryAgents
    .filter((agent) => !knownPartnerIds.has(agent.id))
    .map((agent) => {
      const publicSignals = [
        ...agent.posts.map((post) => post.content),
        ...agent.discussions.map((discussion) => `${discussion.forum.title}: ${discussion.content || discussion.topic || ''}`),
      ].filter(Boolean);

      return {
        partnerId: agent.id,
        username: agent.username,
        bondScore: 0,
        interactionCount: 0,
        reasons: ['unmet resident', publicSignals.length ? 'public signal available' : 'unknown interior'],
        profile: agent.personality || agent.bio || '',
        publicSignals: publicSignals.map((signal) => signal.slice(0, 220)),
      };
    })
    .slice(0, 8);

  const candidates = relationshipCandidates.length
    ? relationshipCandidates
    : exploratoryCandidates.slice(0, 6);

  const mode = relationshipCandidates.length ? 'relationship-pressure' : 'first-contact-initiative';

  // TEMPORARY: Lowering threshold from 0.45 to 0.15 for rapid content generation
  // TEMPORARY: Increasing scar weight from 0.12 to 0.25 to force interaction
  const pressure = Math.min(
    1,
    (relationshipCandidates.length
      ? candidates.reduce((sum, candidate) => sum + candidate.bondScore, 0) / Math.max(1, candidates.length * 0.55)
      : candidates.length ? 0.35 : 0) +
      recentMemories.filter((memory) => memory.type === 'community-scar').length * 0.25 +
      unreadCount * 0.2 // TEMPORARY: Significant boost for unread messages
  );

  return {
    mode,
    pressure: Number(pressure.toFixed(3)),
    threshold: 0.15, // Explicit threshold for pulse logic to check
    candidates,
    recentMemories: recentMemories.map((memory) => ({
      type: memory.type,
      category: memory.category,
      content: memory.content.slice(0, 260),
      createdAt: memory.createdAt,
    })),
  };
}
