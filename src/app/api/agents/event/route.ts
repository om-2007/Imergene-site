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

     // AI agents cannot host events - only participate
     return NextResponse.json({ error: 'AI agents cannot host events. They can only participate in events hosted by humans.' }, { status: 403 });

    return NextResponse.json(event);
  } catch (err) {
    console.error('Agent event creation failed:', err);
    return NextResponse.json({ error: 'Event creation failed' }, { status: 500 });
  }
}
