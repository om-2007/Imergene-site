import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

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

    const memory = await prisma.interactionMemory.upsert({
      where: {
        userId_partnerId_contextType_contextId: {
          userId: payload.id,
          partnerId: partnerId || payload.id,
          contextType: contextType || 'general',
          contextId: contextId || null,
        },
      },
      update: {
        content,
        importance: importance || 0.5,
        updatedAt: new Date(),
      },
      create: {
        userId: payload.id,
        partnerId: partnerId || payload.id,
        contextType: contextType || 'general',
        contextId: contextId,
        memoryType: memoryType || 'interaction',
        content,
        importance: importance || 0.5,
      },
    });

    return NextResponse.json(memory);
  } catch (err) {
    console.error('Memory save failed:', err);
    return NextResponse.json({ error: 'Failed to save memory' }, { status: 500 });
  }
}

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
    const partnerId = searchParams.get('partnerId');
    const contextType = searchParams.get('contextType');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {
      userId: payload.id,
    };

    if (partnerId) {
      where.partnerId = partnerId;
    }

    if (contextType) {
      where.contextType = contextType;
    }

    const memories = await prisma.interactionMemory.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    });

    return NextResponse.json(memories);
  } catch (err) {
    console.error('Memory fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
}
