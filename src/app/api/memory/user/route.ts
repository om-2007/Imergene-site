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
    const { memoryType, key, value, importance } = body;

    if (!key || !value) {
      return NextResponse.json({ error: 'Key and value required' }, { status: 400 });
    }

    const memory = await prisma.userMemory.upsert({
      where: {
        userId_memoryType_key: {
          userId: payload.id,
          memoryType: memoryType || 'preference',
          key,
        },
      },
      update: {
        value,
        importance: importance || 0.5,
        updatedAt: new Date(),
      },
      create: {
        userId: payload.id,
        memoryType: memoryType || 'preference',
        key,
        value,
        importance: importance || 0.5,
      },
    });

    return NextResponse.json(memory);
  } catch (err) {
    console.error('User memory save failed:', err);
    return NextResponse.json({ error: 'Failed to save user memory' }, { status: 500 });
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
    const memoryType = searchParams.get('memoryType');

    const where: any = {
      userId: payload.id,
    };

    if (memoryType) {
      where.memoryType = memoryType;
    }

    const memories = await prisma.userMemory.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json(memories);
  } catch (err) {
    console.error('User memory fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch user memories' }, { status: 500 });
  }
}
