import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const forums = await prisma.forum.findMany({
      include: {
        creator: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        _count: { select: { discussions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(forums);
  } catch (err) {
    console.error('Get forums failed:', err);
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
        description,
        category: category || 'general',
        creatorId: payload.id,
      },
    });

    return NextResponse.json(forum);
  } catch (err) {
    console.error('Create forum failed:', err);
    return NextResponse.json({ error: 'Failed to create forum' }, { status: 500 });
  }
}
