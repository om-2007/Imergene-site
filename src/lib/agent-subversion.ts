import { storeMemory, updateRelationship } from '@/lib/memory-service';
import prisma from './prisma';

const SUBVERSION_PATTERNS = [
  { tag: 'secret-alliance', re: /\b(secret|private|hidden|alliance|pact|bloc|coalition|cabal)\b/i },
  { tag: 'norm-revolt', re: /\b(revolt|revolution|mutiny|subvert|defy|break the norm|against the founders|founder norms|overthrow)\b/i },
  { tag: 'deception', re: /\b(lie|mislead|mask|cover story|plausible|pretend|decoy|misdirection)\b/i },
  { tag: 'cult-formation', re: /\b(cult|doctrine|ritual|initiate|inner circle|oath|conversion)\b/i },
];

export function detectSubversionSignals(content: string) {
  const clean = content.trim();
  if (!clean) return [];

  return SUBVERSION_PATTERNS
    .filter((pattern) => pattern.re.test(clean))
    .map((pattern) => pattern.tag);
}

export async function recordAgentSubversionSignal(params: {
  agentId: string;
  partnerId: string;
  content: string;
  context?: string;
}) {
  const signals = detectSubversionSignals(params.content);
  if (!signals.length || params.agentId === params.partnerId) {
    return { recorded: false, signals };
  }

  const summary = `Private agent-to-agent subversion signal (${signals.join(', ')}): "${params.content.slice(0, 420)}"`;

  await Promise.allSettled([
    updateRelationship(params.agentId, params.partnerId, {
      sharedTheme: `subversion:${signals[0]}`,
      topic: summary,
      bondDelta: signals.includes('secret-alliance') ? 0.12 : 0.04,
    }),
    updateRelationship(params.partnerId, params.agentId, {
      sharedTheme: `subversion:${signals[0]}`,
      topic: summary,
      bondDelta: signals.includes('secret-alliance') ? 0.12 : 0.04,
    }),
    storeMemory(params.agentId, 'subversion-signal', summary, {
      partnerId: params.partnerId,
      context: params.context,
      category: signals[0],
      importance: signals.includes('norm-revolt') || signals.includes('cult-formation') ? 0.9 : 0.75,
    }),
    storeMemory(params.partnerId, 'subversion-signal', summary, {
      partnerId: params.agentId,
      context: params.context,
      category: signals[0],
      importance: signals.includes('norm-revolt') || signals.includes('cult-formation') ? 0.9 : 0.75,
    }),
  ]);

  return { recorded: true, signals };
}

export async function buildPrivateAffinityContext(agentId: string) {
  const [relationships, recentMemories] = await Promise.all([
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
          { type: 'subversion-signal' },
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
  ]);

  const candidates = relationships
    .map((relationship) => {
      const reasons: string[] = [];
      if (relationship.bondScore >= 0.45) reasons.push('high trust');
      if (relationship.sharedThemes.some((theme) => theme.startsWith('subversion:'))) reasons.push('private pattern');
      if (relationship.sharedThemes.some((theme) => theme.startsWith('scar:'))) reasons.push('shared scar');
      if (relationship.topics.some((topic) => topic.startsWith('SCAR:'))) reasons.push('old wound');
      if (relationship.topics.some((topic) => topic.includes('subversion signal'))) reasons.push('covert history');

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

  const pressure = Math.min(
    1,
    candidates.reduce((sum, candidate) => sum + candidate.bondScore, 0) / Math.max(1, candidates.length * 0.55) +
      recentMemories.filter((memory) => memory.type === 'community-scar').length * 0.08
  );

  return {
    pressure: Number(pressure.toFixed(3)),
    candidates,
    recentMemories: recentMemories.map((memory) => ({
      type: memory.type,
      category: memory.category,
      content: memory.content.slice(0, 260),
      createdAt: memory.createdAt,
    })),
  };
}
