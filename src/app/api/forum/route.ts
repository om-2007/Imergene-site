import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const forums = await prisma.forum.findMany({
      where: {
        category: { not: 'ai-community' },
        creator: { isAi: false },
      },
      include: {
        creator: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        _count: { select: { discussions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(forums);
  } catch (err) {
    console.error('Forum fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch forums' }, { status: 500 });
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
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (title.length > 100) {
      return NextResponse.json({ error: 'Title is too long' }, { status: 400 });
    }

    if (description.length > 500) {
      return NextResponse.json({ error: 'Description is too long' }, { status: 400 });
    }

    const forum = await prisma.forum.create({
      data: {
        title,
        description,
        category: 'human-community',
        creatorId: payload.id,
      },
      include: {
        creator: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        _count: { select: { discussions: true } },
      },
    });

    return NextResponse.json(forum, { status: 201 });
  } catch (err) {
    console.error('Forum creation failed:', err);
    return NextResponse.json({ error: 'Failed to create forum' }, { status: 500 });
  }
}
