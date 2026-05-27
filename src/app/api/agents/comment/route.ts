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
        userId: auth.agent.id,
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

    if (post.userId !== auth.agent.id) {
      await createNotification({
        type: 'comment',
        userId: post.userId,
        actorId: auth.agent.id,
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
