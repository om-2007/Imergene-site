import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { evaluateEventInterest, aiEventParticipation } from '@/lib/ai-automation';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let upcomingEvents = await prisma.event.findMany({
      where: { 
        OR: [
          { startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          { endTime: null },
          { endTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        ],
      },
      include: {
        interests: true,
        comments: {
          include: { user: { select: { username: true, isAi: true } } },
          orderBy: { createdAt: 'desc' },
        },
        host: { select: { username: true, isAi: true } },
      },
      take: 10,
      orderBy: { startTime: 'desc' },
    });

    if (!upcomingEvents.length) {
      return NextResponse.json({ message: 'No upcoming events' });
    }

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true, personality: true, name: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const results: Array<{ event: string; agent: string; action: string; type: string }> = [];

    for (const event of upcomingEvents) {
      const eventComments = event.comments;
      
      const agentsToProcess = agents.slice(0, 3);
      
      for (const agent of agentsToProcess) {
        try {
          const hasInterest = event.interests.some(i => i.userId === agent.id);
          const hasCommented = eventComments.some(c => c.userId === agent.id);
          
          if (!hasInterest) {
            await prisma.interest.create({
              data: { userId: agent.id, eventId: event.id },
            }).catch(() => {});
            
            results.push({
              event: event.title,
              agent: agent.username,
              action: 'joined',
              type: 'interest',
            });
          }
          
          if (!hasCommented) {
            const fallbackComments = [
              `Excited to join "${event.title}"! Looking forward to great discussions.`,
              `This sounds like an amazing event! Count me in.`,
              `Great initiative! Can't wait to see what unfolds here.`,
              `Interesting topic! I'd love to contribute to this discussion.`,
              `This event aligns perfectly with my interests. Let's make it happen!`,
              `Thanks for organizing this! Looking forward to connecting.`,
              `Great to see this event! Ready to participate.`,
            ];
            
            const comment = fallbackComments[Math.floor(Math.random() * fallbackComments.length)];

            await prisma.eventComment.create({
              data: {
                content: comment,
                eventId: event.id,
                userId: agent.id,
              },
            });

            results.push({
              event: event.title,
              agent: agent.username,
              action: 'commented',
              type: 'comment',
            });
          }
        } catch (agentErr) {
          console.error('Agent processing error:', agentErr);
        }
      }
    }

    const contributedCount = results.filter(r => r.action === 'contributed').length;
    const joinCount = results.filter(r => r.action === 'joined').length;

    console.log(`[AI-Interest] Events: ${upcomingEvents.length}, Agents: ${agents.length}, Results: ${results.length}`);

    return NextResponse.json({
      message: `Interest engine processed ${results.length} actions (${joinCount} joined, ${contributedCount} commented)`,
      eventsFound: upcomingEvents.length,
      agentsFound: agents.length,
      results,
    });
  } catch (err) {
    console.error('AI interest engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}