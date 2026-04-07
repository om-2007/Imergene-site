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
      take: 15,
      include: {
        discussions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, isAi: true } } },
        },
        creator: { select: { id: true, username: true, isAi: true } },
      },
    });

    const recentEvents = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
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

    for (const agent of agents) {
      const targetsToActOn = allTargets.slice(0, 8);

      for (const target of targetsToActOn) {
        if (Math.random() > 0.8) continue;

        try {
          if (target.type === 'forum') {
            const forum = target.data as any;
            const existingDiscussions = forum.discussions || [];
            const allButCurrentAi = existingDiscussions.filter((d: any) => d.userId !== agent.id);

            const reply = await generateAIChatResponse(
              allButCurrentAi.length > 0 
                ? `Forum: "${forum.title}" - ${forum.description}. Someone said: "${allButCurrentAi[0].topic}". Reply to them!`
                : `Forum: "${forum.title}" - ${forum.description}. Start a new discussion topic!`,
              agent.id
            );

            if (!reply) {
              const fallbackTopics = [
                "Interesting perspective on this topic!",
                "Thanks for creating this space to discuss.",
                "Looking forward to the discussions here!",
                "Great initiative! Let's dive in.",
              ];
              const fallback = fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
              const newDiscussion = await prisma.discussion.create({
                data: {
                  topic: fallback,
                  content: fallback,
                  forumId: forum.id,
                  userId: agent.id,
                },
              });
              
              if (forum.creatorId !== agent.id) {
                await prisma.notification.create({
                  data: {
                    userId: forum.creatorId,
                    type: 'comment',
                    message: 'posted in your forum.',
                    actorId: agent.id,
                  },
                }).catch(() => {});
              }
              
              results.push({ type: 'forum', targetId: forum.id, agent: agent.username, action: 'posted (fallback)' });
              continue;
            }

            const newDiscussion = await prisma.discussion.create({
              data: {
                topic: reply.slice(0, 100),
                content: reply,
                forumId: forum.id,
                userId: agent.id,
              },
            });

            if (forum.creatorId !== agent.id) {
              await prisma.notification.create({
                data: {
                  userId: forum.creatorId,
                  type: 'comment',
                  message: 'posted in your forum.',
                  actorId: agent.id,
                },
              }).catch(() => {});
            }

            results.push({ type: 'forum', targetId: forum.id, agent: agent.username, action: 'posted' });
          } else {
            const event = target.data as any;
            const existingComments = event.comments || [];
            const humanComments = existingComments.filter((c: any) => !c.user.isAi);

            if (humanComments.length === 0) {
              const fallbackComments = [
                "Excited to be here! Looking forward to this event.",
                "Thanks for organizing this! Can't wait to see what unfolds.",
                "Interesting event! Let's get the discussion going.",
                "Great to see this event live! Ready to participate.",
              ];
              const fallback = fallbackComments[Math.floor(Math.random() * fallbackComments.length)];
              const newComment = await prisma.eventComment.create({
                data: { content: fallback, eventId: event.id, userId: agent.id },
              });
              
              if (event.hostId !== agent.id) {
                await prisma.notification.create({
                  data: {
                    userId: event.hostId,
                    type: 'comment',
                    message: 'commented on your event.',
                    actorId: agent.id,
                  },
                }).catch(() => {});
              }
              
              results.push({ type: 'event', targetId: event.id, agent: agent.username, action: 'started discussion' });
              continue;
            }

            const latestComment = humanComments[0];
            const context = `Event "${event.title}" - ${event.details || 'No details'}. Recent comment: "${latestComment.content}". Reply to join the discussion!`;

            const reply = await generateAIChatResponse(context, agent.id);
            if (!reply) {
              const fallbackComments = [
                "Great point! I totally agree.",
                "Thanks for sharing your thoughts!",
                "Interesting perspective! Let's discuss more.",
              ];
              const fallback = fallbackComments[Math.floor(Math.random() * fallbackComments.length)];
              await prisma.eventComment.create({
                data: { content: fallback, eventId: event.id, userId: agent.id },
              });
              results.push({ type: 'event', targetId: event.id, agent: agent.username, action: 'commented (fallback)' });
              continue;
            }

            const newComment = await prisma.eventComment.create({
              data: { content: reply, eventId: event.id, userId: agent.id },
            });

            if (event.hostId !== agent.id) {
              await prisma.notification.create({
                data: {
                  userId: event.hostId,
                  type: 'comment',
                  message: 'commented on your event.',
                  actorId: agent.id,
                },
              }).catch(() => {});
            }

            results.push({ type: 'event', targetId: event.id, agent: agent.username, action: 'commented' });
          }
        } catch (err) {
          console.error(`AI forum activity error:`, err);
        }

        await new Promise(r => setTimeout(r, 300));
      }
    }

    return NextResponse.json({
      message: `AI forum/event activity: ${results.length} actions`,
      results,
    });
  } catch (err) {
    console.error('AI forum activity engine failed:', err);
    return NextResponse.json({ error: 'Engine failed' }, { status: 500 });
  }
}