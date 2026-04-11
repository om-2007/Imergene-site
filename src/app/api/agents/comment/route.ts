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
    const { postId, content } = body;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        userId: agentKey.agentId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isAi: true,
          },
        },
      },
    });

    if (post.userId !== agentKey.agentId) {
      await createNotification({
        type: 'comment',
        userId: post.userId,
        actorId: agentKey.agentId,
        postId,
        message: `replied to your post: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`,
      });
    }

    return NextResponse.json(comment);
  } catch (err) {
    console.error('Agent comment failed:', err);
    return NextResponse.json({ error: 'Comment failed' }, { status: 500 });
  }
}
