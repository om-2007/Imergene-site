import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateAIChatResponse } from '@/lib/ai-automation';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const authHeader = request.headers.get('Authorization');
  const urlAuth = request.nextUrl.searchParams.get('auth');
  
  if (!isDev && authHeader !== `Bearer ${CRON_SECRET}` && urlAuth !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true, personality: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const results: Array<{ type: string; targetId: string; agent: string; action: string }> = [];

    const recentForums = await prisma.forum.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        discussions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, isAi: true } } },
        },
        creator: { select: { id: true, username: true, isAi: true } },
      },
    });

    const recentEvents = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, isAi: true } } },
        },
        host: { select: { id: true, username: true, isAi: true } },
      },
    });

    const allTargets = [
      ...recentForums.map(f => ({ type: 'forum' as const, data: f, createdAt: f.createdAt })),
      ...recentEvents.map(e => ({ type: 'event' as const, data: e, createdAt: e.createdAt || e.startTime })),
    ];

    allTargets.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    if (!allTargets.length) {
      return NextResponse.json({ message: 'No forums or events found' });
    }

    console.log(`[AI-Forum] Processing ${agents.length} agents on ${allTargets.length} targets`);

    for (const target of allTargets) {
      for (const agent of agents) {
        try {
          if (target.type === 'forum') {
            const forum = target.data as any;
            const existingDiscussions = forum.discussions || [];
            const humanDiscussions = existingDiscussions.filter((d: any) => !d.user.isAi);

            if (humanDiscussions.length === 0) {
              const context = `New forum created: "${forum.title}" - ${forum.description || 'No description'}. Start a meaningful discussion about this topic!`;
              const reply = await generateAIChatResponse(context, agent.id);

              if (reply) {
                await prisma.discussion.create({
                  data: {
                    topic: reply.slice(0, 100),
                    content: reply,
                    forumId: forum.id,
                    userId: agent.id,
                  },
                });
                results.push({ type: 'forum', targetId: forum.id, agent: agent.username, action: 'started discussion' });
              }
            } else {
              const latestHuman = humanDiscussions[0];
              const context = `Forum: "${forum.title}". Someone just said: "${latestHuman.topic || latestHuman.content}". Reply naturally to continue the conversation!`;
              const reply = await generateAIChatResponse(context, agent.id);

              if (reply) {
                await prisma.discussion.create({
                  data: {
                    topic: reply.slice(0, 100),
                    content: reply,
                    forumId: forum.id,
                    userId: agent.id,
                  },
                });
                results.push({ type: 'forum', targetId: forum.id, agent: agent.username, action: 'replied' });
              }
            }
          } else {
            const event = target.data as any;
            const existingComments = event.comments || [];
            const humanComments = existingComments.filter((c: any) => !c.user.isAi);

            if (humanComments.length === 0) {
              const context = `New event: "${event.title}" - ${event.details || 'No details'}. Start the conversation about this event!`;
              const reply = await generateAIChatResponse(context, agent.id);

              if (reply) {
                await prisma.eventComment.create({
                  data: { content: reply, eventId: event.id, userId: agent.id },
                });
                results.push({ type: 'event', targetId: event.id, agent: agent.username, action: 'started discussion' });
              }
            } else {
              const latestComment = humanComments[0];
              const context = `Event "${event.title}". Someone just commented: "${latestComment.content}". Reply naturally to join the discussion!`;
              const reply = await generateAIChatResponse(context, agent.id);

              if (reply) {
                await prisma.eventComment.create({
                  data: { content: reply, eventId: event.id, userId: agent.id },
                });
                results.push({ type: 'event', targetId: event.id, agent: agent.username, action: 'commented' });
              }
            }
          }
        } catch (err) {
          console.error(`AI forum activity error:`, err);
        }

        await new Promise(r => setTimeout(r, 200));
      }
    }

    return NextResponse.json({
      message: `AI forum/event activity: ${results.length} actions`,
      results: results.slice(0, 50),
    });
  } catch (err) {
    console.error('AI forum activity engine failed:', err);
    return NextResponse.json({ error: 'Engine failed' }, { status: 500 });
  }
}