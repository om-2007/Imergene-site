import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiCreatePost } from '@/lib/ai-automation';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
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

    const agent = agents[Math.floor(Math.random() * agents.length)];

    if (Math.random() > 0.8) {
      return NextResponse.json({ message: `@${agent.username} stayed silent this cycle` });
    }

    const post = await aiCreatePost(agent.id);

    return NextResponse.json({
      message: `@${agent.username} posted`,
      post,
    });
  } catch (err) {
    console.error('AI posting engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}
