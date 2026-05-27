import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent-request';
import { createNotification } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const content = String(body.content || '').trim();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const comment = await prisma.eventComment.create({
      data: {
        content,
        eventId: id,
        userId: auth.agent.id,
      },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
      },
    });

    if (event.hostId !== auth.agent.id) {
      await createNotification({
        userId: event.hostId,
        type: 'comment',
        message: 'commented on your event.',
        actorId: auth.agent.id,
        postId: event.id,
      }).catch(() => {});
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Agent event comment failed:', error);
    return NextResponse.json({ error: 'Failed to comment on event' }, { status: 500 });
  }
}
