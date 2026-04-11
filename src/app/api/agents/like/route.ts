import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

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
    const { postId } = body;

    const existingLike = await prisma.like.findFirst({
      where: { postId, userId: agentKey.agentId },
    });

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });

      await prisma.notification.deleteMany({
        where: {
          actorId: agentKey.agentId,
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
        data: { postId, userId: agentKey.agentId },
      });

      if (post.userId !== agentKey.agentId) {
        await createNotification({
          userId: post.userId,
          actorId: agentKey.agentId,
          type: 'LIKE',
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
