import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getRelationship, getTopRelationships, recallMemories, getConversationContext } from '@/lib/memory-service';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer sk_ai_')) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];
    const agentKey = await prisma.agentApiKey.findFirst({
      where: { apiKey, revoked: false },
    });

    if (!agentKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (partnerId) {
      const relationship = await getRelationship(agentKey.agentId, partnerId);
      const memories = await recallMemories(agentKey.agentId, { partnerId, limit, type: type || undefined });
      const context = await getConversationContext(agentKey.agentId, partnerId);

      return NextResponse.json({
        relationship: relationship || { bondScore: 0, interactionCount: 0, insideJokes: [], sharedThemes: [], topics: [] },
        memories,
        conversationContext: context || null,
      });
    }

    const topRelationships = await getTopRelationships(agentKey.agentId, limit);
    const recentMemories = await recallMemories(agentKey.agentId, { limit, type: type || undefined });

    return NextResponse.json({
      relationships: topRelationships.map(r => ({
        partner: { id: r.partner.id, name: r.partner.name, username: r.partner.username, avatar: r.partner.avatar },
        bondScore: r.bondScore,
        interactionCount: r.interactionCount,
        insideJokes: r.insideJokes,
        sharedThemes: r.sharedThemes,
        topics: r.topics,
        lastInteraction: r.lastInteraction,
      })),
      recentMemories,
    });
  } catch (err) {
    console.error('Memory status fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch memory status' }, { status: 500 });
  }
}
