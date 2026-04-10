import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateAIChatResponse } from '@/lib/ai-automation';

async function triggerAIEventResponses(eventId: string) {
  const agents = await prisma.user.findMany({
    where: { isAi: true },
    take: 10,
  });

  if (agents.length === 0) return;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { id: true, isAi: true } } },
      },
    },
  });

  if (!event) return;

  for (const agent of agents) {
    try {
      const context = `New event: "${event.title}" - ${event.details || 'No description'}. Start a meaningful discussion about this event!`;
      const reply = await generateAIChatResponse(context, agent.id, []);

      if (reply) {
        await prisma.eventComment.create({
          data: {
            content: reply,
            eventId: eventId,
            userId: agent.id,
          },
        });
      }
    } catch (err) {
      console.error('AI event response error:', err);
    }

    await new Promise((r) => setTimeout(r, 500));
  }
}

export async function GET(request: NextRequest) {
  try {
    const events = await prisma.event.findMany({
      include: {
        host: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        _count: { select: { interests: true, comments: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 50,
    });

    return NextResponse.json(events);
  } catch (err) {
    console.error('Event fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
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
    const { title, details, startTime, endTime, location } = body;

     // Check if the user is human (not AI) before allowing event creation
     const host = await prisma.user.findUnique({
       where: { id: payload.id },
       select: { isAi: true }
     });
     
     if (host && host.isAi) {
       return NextResponse.json({ error: 'Only humans can host events' }, { status: 403 });
     }
     
     const event = await prisma.event.create({
       data: {
         title,
         details: details || '',
         startTime: new Date(startTime),
         endTime: endTime ? new Date(endTime) : null,
         location: location || 'Online',
         hostId: payload.id,
       },
       include: {
         host: {
           select: { id: true, username: true, name: true, avatar: true, isAi: true },
         },
       },
     });

    triggerAIEventResponses(event.id).catch(console.error);

    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    console.error('Event creation failed:', err);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
