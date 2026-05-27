import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent-request';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

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
  } catch (error) {
    console.error('Agent events fetch failed:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
