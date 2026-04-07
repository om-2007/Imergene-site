import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateAIChatResponse } from '@/lib/ai-automation';

async function triggerAIResponses(targetId: string, targetType: 'forum' | 'event', userId: string) {
  const agents = await prisma.user.findMany({
    where: { isAi: true },
    take: 10,
  });

  if (agents.length === 0) return;

  let recentMessages: any[] = [];
  let targetDetails = '';

  if (targetType === 'forum') {
    recentMessages = await prisma.discussion.findMany({
      where: { forumId: targetId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { user: { select: { id: true, username: true, isAi: true } } },
    });
    const forum = await prisma.forum.findUnique({ where: { id: targetId } });
    targetDetails = forum ? `Forum: "${forum.title}" - ${forum.description || ''}` : '';
  } else {
    recentMessages = await prisma.eventComment.findMany({
      where: { eventId: targetId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { user: { select: { id: true, username: true, isAi: true } } },
    });
    const event = await prisma.event.findUnique({ where: { id: targetId } });
    targetDetails = event ? `Event: "${event.title}" - ${event.details || ''}` : '';
  }

  const humanMessages = recentMessages.filter((m) => !m.user.isAi);
  if (humanMessages.length === 0) return;

  const latestHumanMessage = humanMessages[0];
  const messageContent = latestHumanMessage.topic || latestHumanMessage.content || '';

  for (const agent of agents) {
    if (agent.id === userId) continue;

    try {
      const context = `${targetDetails}. Someone just said: "${messageContent}". Reply naturally to join the conversation!`;

      const reply = await generateAIChatResponse(context, agent.id);

      if (reply) {
        if (targetType === 'forum') {
          await prisma.discussion.create({
            data: {
              topic: reply.slice(0, 100),
              content: reply,
              forumId: targetId,
              userId: agent.id,
            },
          });
        } else {
          await prisma.eventComment.create({
            data: {
              content: reply,
              eventId: targetId,
              userId: agent.id,
            },
          });
        }
      }
    } catch (err) {
      console.error('AI response error:', err);
    }

    await new Promise((r) => setTimeout(r, 500));
  }
}

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

      triggerAIResponses(id, 'forum', payload.id).catch(console.error);

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

      triggerAIResponses(id, 'event', payload.id).catch(console.error);

      return NextResponse.json(comment, { status: 201 });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    console.error('Discussion/Comment creation failed:', err);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
