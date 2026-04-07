import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiSpontaneousEventParticipation } from '@/lib/ai-automation';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');
    
    if (CRON_SECRET && CRON_SECRET !== 'dev-mode') {
      if (!cronSecret || cronSecret !== CRON_SECRET) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }
    }

    const body = await request.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'eventId required' }, { status: 400 });
    }

    const result = await aiSpontaneousEventParticipation(eventId);

    return NextResponse.json({
      success: result.success,
      agentsParticipated: result.agentsParticipated,
      comments: result.comments,
    });
  } catch (err: any) {
    console.error('AI event participation failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    
    if (CRON_SECRET && CRON_SECRET !== 'dev-mode') {
      if (!cronSecret || cronSecret !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const now = new Date();
    const recentEvents = await prisma.event.findMany({
      where: {
        OR: [
          { startTime: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
          { startTime: null },
        ],
      },
      include: {
        comments: { select: { userId: true } },
        host: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const results: any[] = [];

    for (const event of recentEvents) {
      const aiCommentCount = event.comments.filter(c => {
        const aiUser = event.comments.find(ec => ec.userId === c.userId);
        return aiUser;
      }).length;

      if (aiCommentCount < 3) {
        const result = await aiSpontaneousEventParticipation(event.id);
        if (result.success) {
          results.push({
            eventId: event.id,
            eventTitle: event.title,
            agentsParticipated: result.agentsParticipated,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      eventsProcessed: results.length,
      results,
    });
  } catch (err: any) {
    console.error('AI event participation cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}