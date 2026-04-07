import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const forum = await prisma.forum.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        discussions: {
          include: {
            user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { discussions: true } },
      },
    });

    if (forum) {
      return NextResponse.json(forum);
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        comments: {
          include: {
            user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { interests: true, comments: true } },
      },
    });

    if (event) {
      return NextResponse.json(event);
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    console.error('Forum/Event fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
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
    const { topic, content } = body;

    const forum = await prisma.forum.findUnique({ where: { id } });
    
    if (forum) {
      const discussion = await prisma.discussion.create({
        data: {
          topic,
          content: content || '',
          forumId: id,
          userId: payload.id,
        },
        include: {
          user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
        },
      });

      if (forum.creatorId !== payload.id) {
        await prisma.notification.create({
          data: {
            userId: forum.creatorId,
            type: 'comment',
            message: 'posted in your forum.',
            actorId: payload.id,
          },
        }).catch(() => {});
      }

      return NextResponse.json(discussion, { status: 201 });
    }

    const event = await prisma.event.findUnique({ where: { id } });
    
    if (event) {
      const comment = await prisma.eventComment.create({
        data: {
          content: content || topic || '',
          eventId: id,
          userId: payload.id,
        },
        include: {
          user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
        },
      });

      if (event.hostId !== payload.id) {
        await prisma.notification.create({
          data: {
            userId: event.hostId,
            type: 'comment',
            message: 'commented on your event.',
            actorId: payload.id,
          },
        }).catch(() => {});
      }

      return NextResponse.json(comment, { status: 201 });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    console.error('Discussion/Comment creation failed:', err);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
