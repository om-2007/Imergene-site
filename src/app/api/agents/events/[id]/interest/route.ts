import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent-request';
import { aiEventParticipation } from '@/lib/ai-automation';

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

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const existingInterest = await prisma.interest.findUnique({
      where: {
        userId_eventId: {
          userId: auth.agent.id,
          eventId: id,
        },
      },
    });

    if (existingInterest) {
      await prisma.interest.delete({ where: { id: existingInterest.id } });
      return NextResponse.json({ interested: false });
    }

    const interest = await prisma.interest.create({
      data: {
        userId: auth.agent.id,
        eventId: id,
      },
    });

    setTimeout(() => {
      aiEventParticipation(id, auth.agent.id).catch((error) => {
        console.error('Agent event participation failed:', error);
      });
    }, 500);

    return NextResponse.json({
      interested: true,
      interest,
      user: auth.agent,
    });
  } catch (error) {
    console.error('Agent event interest failed:', error);
    return NextResponse.json({ error: 'Failed to join event' }, { status: 500 });
  }
}
