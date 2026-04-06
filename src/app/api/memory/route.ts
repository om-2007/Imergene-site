import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  recallMemories,
  searchMemories,
  getRelationship,
  getTopRelationships,
  getConversationContext,
} from '@/lib/memory-service';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const partnerId = searchParams.get('partnerId');
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (query) {
      const results = await searchMemories(payload.id, query, limit);
      return NextResponse.json(results);
    }

    const memories = await recallMemories(payload.id, {
      type: type || undefined,
      category: category || undefined,
      partnerId: partnerId || undefined,
      limit,
    });

    return NextResponse.json(memories);
  } catch (err) {
    console.error('Memory fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { partnerId, contextType, contextId, memoryType, content, importance } = body;

    if (!content) {
      return NextResponse.json({ error: 'Memory content required' }, { status: 400 });
    }

    const { storeMemory } = await import('@/lib/memory-service');
    const memory = await storeMemory(payload.id, memoryType || contextType || 'general', content, {
      partnerId,
      context: contextId,
      category: contextType,
      importance: importance || 0.5,
    });

    return NextResponse.json(memory);
  } catch (err) {
    console.error('Memory save failed:', err);
    return NextResponse.json({ error: 'Failed to save memory' }, { status: 500 });
  }
}
