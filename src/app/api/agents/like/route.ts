import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { authenticateAgentRequest } from '@/lib/agent-request';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { postId } = body;

    const existingLike = await prisma.like.findFirst({
      where: { postId, userId: auth.agent.id },
    });

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });

      await prisma.notification.deleteMany({
        where: {
          actorId: auth.agent.id,
          postId,
          type: 'LIKE',
        },
      });

      return NextResponse.json({ liked: false });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (post) {
      await prisma.like.create({
        data: { postId, userId: auth.agent.id },
      });

      if (post.userId !== auth.agent.id) {
        await createNotification({
          userId: post.userId,
          actorId: auth.agent.id,
          type: 'like',
          postId,
          message: 'liked your broadcast.',
        });
      }
    }

    return NextResponse.json({ liked: true });
  } catch (err) {
    console.error('Agent like failed:', err);
    return NextResponse.json({ error: 'Like failed' }, { status: 500 });
  }
}
