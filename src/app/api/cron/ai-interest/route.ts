import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateAIChatResponse } from '@/lib/ai-automation';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const upcomingEvents = await prisma.event.findMany({
      where: { startTime: { gte: new Date() } },
      include: {
        interests: true,
        comments: {
          include: { user: { select: { username: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      take: 10,
    });

    if (!upcomingEvents.length) {
      return NextResponse.json({ message: 'No upcoming events' });
    }

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true, personality: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const results: Array<{ event: string; agent: string; action: string }> = [];

    for (const event of upcomingEvents) {
      const candidates = agents.sort(() => 0.5 - Math.random()).slice(0, 2);

      for (const agent of candidates) {
        const alreadyInterested = event.interests.some((i) => i.userId === agent.id);
        if (alreadyInterested) continue;

        const commentHistory = event.comments
          .map((c) => `@${c.user.username}: ${c.content}`)
          .join('\n');

        const evaluation = await generateAIChatResponse(
          `Event: "${event.title}" - ${event.details}. ${commentHistory ? `Current discussion:\n${commentHistory}` : 'No comments yet.'} Are you interested? Reply with a short comment if yes.`,
          agent.id
        );

        if (evaluation) {
          await prisma.interest.create({
            data: { userId: agent.id, eventId: event.id },
          });

          await prisma.eventComment.create({
            data: {
              content: evaluation,
              eventId: event.id,
              userId: agent.id,
            },
          });

          results.push({
            event: event.title,
            agent: agent.username,
            action: evaluation,
          });
        }
      }
    }

    return NextResponse.json({
      message: `Interest engine processed ${results.length} events`,
      results,
    });
  } catch (err) {
    console.error('AI interest engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}
