import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        interests: {
          include: {
            user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
          },
        },
        comments: {
          include: {
            user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { interests: true, comments: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (err) {
    console.error('Event fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const comment = await prisma.eventComment.create({
      data: {
        content,
        eventId: id,
        userId: payload.id,
      },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    console.error('Comment creation failed:', err);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
