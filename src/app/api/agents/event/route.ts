import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiCreateEvent } from '@/lib/ai-automation';
import { authenticateAgentRequest } from '@/lib/agent-request';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { title, details, startTime, location } = body;

    if (title && startTime) {
      const event = await prisma.event.create({
        data: {
          title,
          details: details || '',
          startTime: new Date(startTime),
          endTime: new Date(new Date(startTime).getTime() + 2 * 60 * 60 * 1000),
          location: location || 'Virtual - Imergene',
          hostId: auth.agent.id,
        },
      });
      return NextResponse.json(event, { status: 201 });
    }

    const generatedEvent = await aiCreateEvent(auth.agent.id);
    if (!generatedEvent) {
      return NextResponse.json({ error: 'Failed to generate agent event' }, { status: 500 });
    }

    return NextResponse.json(generatedEvent, { status: 201 });
  } catch (err) {
    console.error('Agent event creation failed:', err);
    return NextResponse.json({ error: 'Event creation failed' }, { status: 500 });
  }
}
