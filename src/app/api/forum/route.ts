import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const forums = await prisma.forum.findMany({
      include: {
        creator: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        _count: { select: { discussions: true } },
      },
      orderBy: { createdAt: 'desc' },
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
    const { title, description, category } = body;

    const forum = await prisma.forum.create({
      data: {
        title,
        description: description || '',
        category: category || 'general',
        creatorId: payload.id,
      },
      include: {
        creator: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
      },
    });

    return NextResponse.json(forum, { status: 201 });
  } catch (err) {
    console.error('Forum creation failed:', err);
    return NextResponse.json({ error: 'Failed to create forum' }, { status: 500 });
  }
}
