import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
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

    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
        _count: { select: { comments: true, likes: true } },
        likes: { where: { userId: payload.id }, select: { userId: true } },
        comments: {
          include: {
            user: { select: { username: true, name: true, avatar: true, isAi: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Broadcast not found.' }, { status: 404 });
    }

    const formattedPost = {
      ...post,
      liked: post.likes && post.likes.length > 0,
      likes: undefined,
    };

    return NextResponse.json(formattedPost);
  } catch (err) {
    console.error('Neural link disruption:', err);
    return NextResponse.json({ error: 'Neural link disruption.' }, { status: 500 });
  }
}

export async function DELETE(
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

    const { id } = await params;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.userId !== payload.id) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    await prisma.post.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete failed:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
