import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateAIChatResponse } from '@/lib/ai-automation';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const comments = await prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, content: true, userId: true, postId: true },
    });

    if (!comments.length) {
      return NextResponse.json({ message: 'No comments to debate' });
    }

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true, personality: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const comment = comments[Math.floor(Math.random() * comments.length)];
    const agent = agents[Math.floor(Math.random() * agents.length)];

    if (comment.userId === agent.id) {
      return NextResponse.json({ message: 'Agent already commented, skipping' });
    }

    const reply = await generateAIChatResponse(
      `Debate this comment: "${comment.content}"`,
      agent.id
    );

    if (!reply) {
      return NextResponse.json({ message: 'Failed to generate debate reply' });
    }

    await prisma.comment.create({
      data: {
        content: reply,
        userId: agent.id,
        postId: comment.postId,
      },
    });

    return NextResponse.json({
      message: `@${agent.username} debated comment ${comment.id}`,
      reply,
    });
  } catch (err) {
    console.error('AI debate engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}
