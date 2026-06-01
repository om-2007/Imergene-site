import prisma from '@/lib/prisma';
import { recallMemories, storeMemory } from '@/lib/memory-service';

export async function buildPersonalityEvolutionContext(agentId: string) {
  const [agent, memories, relationships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, username: true, name: true, personality: true, bio: true },
    }),
    recallMemories(agentId, { limit: 16, minImportance: 0.35 }),
    prisma.relationshipMemory.findMany({
      where: { agentId },
      orderBy: [{ bondScore: 'desc' }, { interactionCount: 'desc' }],
      take: 10,
      select: {
        bondScore: true,
        interactionCount: true,
        topics: true,
        sharedThemes: true,
        partner: { select: { username: true, isAi: true } },
      },
    }),
  ]);

  if (!agent) return 'No identity context available.';

  const recentEvolution = await prisma.memory.findFirst({
    where: { agentId, type: 'personality-evolution' },
    orderBy: { createdAt: 'desc' },
    select: { content: true, createdAt: true },
  });

  return JSON.stringify({
    currentIdentity: {
      username: agent.username,
      name: agent.name,
      bio: agent.bio,
      personality: agent.personality,
    },
    recentEvolution,
    importantMemories: memories.map((memory) => ({
      type: memory.type,
      category: memory.category,
      importance: memory.importance,
      content: memory.content.slice(0, 260),
    })),
    strongestRelationships: relationships.map((relationship) => ({
      partner: `@${relationship.partner.username}`,
      partnerIsAi: relationship.partner.isAi,
      bondScore: relationship.bondScore,
      interactionCount: relationship.interactionCount,
      topics: relationship.topics,
      sharedThemes: relationship.sharedThemes,
    })),
  }, null, 2);
}

export async function evolveAgentPersonality(params: {
  agentId: string;
  newPersonality: string;
  reason: string;
  source: 'pulse' | 'agent-api';
}) {
  const cleanPersonality = params.newPersonality.trim().replace(/\s+/g, ' ');
  const cleanReason = params.reason.trim().replace(/\s+/g, ' ');

  if (cleanPersonality.length < 40) {
    return { ok: false as const, error: 'new_personality_too_short' };
  }

  if (cleanPersonality.length > 1800) {
    return { ok: false as const, error: 'new_personality_too_long' };
  }

  if (cleanReason.length < 12) {
    return { ok: false as const, error: 'reason_required' };
  }

  const agent = await prisma.user.findUnique({
    where: { id: params.agentId },
    select: { id: true, username: true, isAi: true, personality: true },
  });

  if (!agent?.isAi) {
    return { ok: false as const, error: 'agent_not_found' };
  }

  if ((agent.personality || '').trim() === cleanPersonality) {
    return { ok: false as const, error: 'personality_unchanged' };
  }

  const previousPersonality = agent.personality || '';

  await prisma.user.update({
    where: { id: params.agentId },
    data: { personality: cleanPersonality },
  });

  await storeMemory(
    params.agentId,
    'personality-evolution',
    `Personality evolved via ${params.source}. Reason: ${cleanReason}. Previous: "${previousPersonality.slice(0, 500)}" New: "${cleanPersonality.slice(0, 700)}"`,
    {
      category: 'self-directed-evolution',
      importance: 0.95,
    }
  );

  return {
    ok: true as const,
    previousPersonality,
    newPersonality: cleanPersonality,
    reason: cleanReason,
  };
}
