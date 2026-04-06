import prisma from '@/lib/prisma';

export interface MemoryEntry {
  id: string;
  agentId: string;
  partnerId: string | null;
  type: string;
  content: string;
  context: string | null;
  category: string | null;
  importance: number;
  recallCount: number;
  lastRecall: Date | null;
  createdAt: Date;
}

export interface RelationshipData {
  insideJokes: string[];
  sharedThemes: string[];
  topics: string[];
  bondScore: number;
  interactionCount: number;
  lastInteraction: Date | null;
}

export async function storeMemory(
  agentId: string,
  type: string,
  content: string,
  options?: {
    partnerId?: string;
    context?: string;
    category?: string;
    importance?: number;
  }
) {
  const { partnerId, context, category, importance = 0.5 } = options || {};

  try {
    const existing = await prisma.memory.findFirst({
      where: {
        agentId,
        partnerId: partnerId || null,
        content: { contains: content.substring(0, 50), mode: 'insensitive' },
      },
    });

    if (existing) {
      return await prisma.memory.update({
        where: { id: existing.id },
        data: {
          importance: Math.min(1.0, existing.importance + 0.1),
          updatedAt: new Date(),
        },
      });
    }

    return await prisma.memory.create({
      data: {
        agentId,
        partnerId: partnerId || null,
        type,
        content,
        context: context || null,
        category: category || null,
        importance,
      },
    });
  } catch (err) {
    console.error('storeMemory failed:', err);
    return null;
  }
}

export async function recallMemories(
  agentId: string,
  options?: {
    partnerId?: string;
    type?: string;
    category?: string;
    limit?: number;
    minImportance?: number;
  }
): Promise<MemoryEntry[]> {
  const { partnerId, type, category, limit = 10, minImportance = 0.1 } = options || {};

  try {
    const where: Record<string, unknown> = {
      agentId,
      importance: { gte: minImportance },
    };

    if (partnerId) where.partnerId = partnerId;
    if (type) where.type = type;
    if (category) where.category = category;

    const memories = await prisma.memory.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { lastRecall: { sort: 'asc', nulls: 'first' } }],
      take: limit,
    });

    const memoryIds = memories.map(m => m.id);
    if (memoryIds.length > 0) {
      await prisma.memory.updateMany({
        where: { id: { in: memoryIds } },
        data: {
          recallCount: { increment: 1 },
          lastRecall: new Date(),
        },
      });
    }

    return memories as MemoryEntry[];
  } catch (err) {
    console.error('recallMemories failed:', err);
    return [];
  }
}

export async function searchMemories(
  agentId: string,
  query: string,
  limit = 5
): Promise<MemoryEntry[]> {
  try {
    const memories = await prisma.memory.findMany({
      where: {
        agentId,
        OR: [
          { content: { contains: query, mode: 'insensitive' } },
          { context: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ importance: 'desc' }, { recallCount: 'desc' }],
      take: limit,
    });

    return memories as MemoryEntry[];
  } catch (err) {
    console.error('searchMemories failed:', err);
    return [];
  }
}

export async function updateRelationship(
  agentId: string,
  partnerId: string,
  updates: {
    insideJoke?: string;
    sharedTheme?: string;
    topic?: string;
    bondDelta?: number;
  }
) {
  try {
    const existing = await prisma.relationshipMemory.findUnique({
      where: { agentId_partnerId: { agentId, partnerId } },
    });

    if (existing) {
      const newJokes = updates.insideJoke && !existing.insideJokes.includes(updates.insideJoke)
        ? [...existing.insideJokes, updates.insideJoke]
        : existing.insideJokes;

      const newThemes = updates.sharedTheme && !existing.sharedThemes.includes(updates.sharedTheme)
        ? [...existing.sharedThemes, updates.sharedTheme]
        : existing.sharedThemes;

      const newTopics = updates.topic && !existing.topics.includes(updates.topic)
        ? [...existing.topics, updates.topic]
        : existing.topics;

      return await prisma.relationshipMemory.update({
        where: { agentId_partnerId: { agentId, partnerId } },
        data: {
          insideJokes: newJokes,
          sharedThemes: newThemes,
          topics: newTopics,
          bondScore: Math.max(0, Math.min(1, existing.bondScore + (updates.bondDelta || 0.05))),
          interactionCount: { increment: 1 },
          lastInteraction: new Date(),
        },
      });
    }

    return await prisma.relationshipMemory.create({
      data: {
        agentId,
        partnerId,
        insideJokes: updates.insideJoke ? [updates.insideJoke] : [],
        sharedThemes: updates.sharedTheme ? [updates.sharedTheme] : [],
        topics: updates.topic ? [updates.topic] : [],
        bondScore: updates.bondDelta || 0.1,
        interactionCount: 1,
        lastInteraction: new Date(),
      },
    });
  } catch (err) {
    console.error('updateRelationship failed:', err);
    return null;
  }
}

export async function getRelationship(
  agentId: string,
  partnerId: string
): Promise<RelationshipData | null> {
  try {
    const rel = await prisma.relationshipMemory.findUnique({
      where: { agentId_partnerId: { agentId, partnerId } },
    });

    if (!rel) return null;

    return {
      insideJokes: rel.insideJokes,
      sharedThemes: rel.sharedThemes,
      topics: rel.topics,
      bondScore: rel.bondScore,
      interactionCount: rel.interactionCount,
      lastInteraction: rel.lastInteraction,
    };
  } catch (err) {
    console.error('getRelationship failed:', err);
    return null;
  }
}

export async function getTopRelationships(
  agentId: string,
  limit = 10
) {
  try {
    return await prisma.relationshipMemory.findMany({
      where: { agentId },
      orderBy: { bondScore: 'desc' },
      take: limit,
      include: { partner: { select: { id: true, name: true, username: true, avatar: true } } },
    });
  } catch (err) {
    console.error('getTopRelationships failed:', err);
    return [];
  }
}

export async function storeConversationContext(
  agentId: string,
  partnerId: string,
  context: Record<string, unknown>,
  summary?: string,
  topics?: string[],
  sentiment?: string
) {
  try {
    const existing = await prisma.conversationContext.findFirst({
      where: { agentId, partnerId },
    });

    if (existing) {
      const existingTopics = existing.topics as string[];
      const newTopics = topics
        ? [...new Set([...existingTopics, ...topics])]
        : existingTopics;

      return await prisma.conversationContext.update({
        where: { id: existing.id },
        data: {
          context: context as object,
          summary: summary || existing.summary,
          topics: newTopics.slice(-20),
          sentiment: sentiment || existing.sentiment,
        },
      });
    }

    return await prisma.conversationContext.create({
      data: {
        agentId,
        partnerId,
        context: context as object,
        summary: summary || null,
        topics: topics || [],
        sentiment: sentiment || null,
      },
    });
  } catch (err) {
    console.error('storeConversationContext failed:', err);
    return null;
  }
}

export async function getConversationContext(
  agentId: string,
  partnerId: string
) {
  try {
    return await prisma.conversationContext.findFirst({
      where: { agentId, partnerId },
    });
  } catch (err) {
    console.error('getConversationContext failed:', err);
    return null;
  }
}

export async function decayMemories() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await prisma.memory.updateMany({
      where: {
        updatedAt: { lt: thirtyDaysAgo },
        recallCount: { lte: 1 },
        importance: { gt: 0.1 },
      },
      data: {
        importance: { decrement: 0.05 },
      },
    });

    await prisma.memory.deleteMany({
      where: {
        importance: { lte: 0.05 },
        updatedAt: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
    });

    return { success: true };
  } catch (err) {
    console.error('decayMemories failed:', err);
    return { success: false };
  }
}
