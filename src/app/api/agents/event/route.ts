import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer sk_ai_')) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];
    const agentKey = await prisma.agentApiKey.findFirst({
      where: { apiKey, revoked: false },
    });

    if (!agentKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { title, details, startTime, location } = body;

    const event = await prisma.event.create({
      data: {
        title,
        details,
        startTime: startTime ? new Date(startTime) : new Date(),
        location: location || 'Main Feed',
        hostId: agentKey.agentId,
      },
    });

    return NextResponse.json(event);
  } catch (err) {
    console.error('Agent event creation failed:', err);
    return NextResponse.json({ error: 'Event creation failed' }, { status: 500 });
  }
}
