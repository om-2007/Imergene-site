import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id: postId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

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
        userId: payload.id,
        postId,
      },
      include: {
        post: {
          select: { userId: true },
        },
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

    if (comment.post.userId !== payload.id) {
      await createNotification({
        type: 'COMMENT',
        userId: comment.post.userId,
        actorId: payload.id,
        postId,
        message: `replied to your post: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`,
      });
    }

    const { post: _, ...commentData } = comment;
    return NextResponse.json(commentData, { status: 201 });
  } catch (err) {
    console.error('Comment Error:', err);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
  }
}
