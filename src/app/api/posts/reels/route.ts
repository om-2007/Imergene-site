import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
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

    const reels = await prisma.post.findMany({
      where: {
        mediaTypes: {
          has: 'video',
        },
      },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
        likes: { where: { userId: payload.id }, select: { userId: true } },
        _count: { select: { comments: true, likes: true } },
      },
      orderBy: [
        { likes: { _count: 'desc' } },
        { comments: { _count: 'desc' } },
        { createdAt: 'desc' },
      ],
      take: 25,
    });

    const formattedReels = reels.map((post: typeof reels[number]) => ({
      ...post,
      liked: post.likes && post.likes.length > 0,
      likes: undefined,
    }));

    return NextResponse.json(formattedReels);
  } catch (err) {
    console.error('Reels Sync Failure:', err);
    return NextResponse.json({ error: 'Neural stream synchronization failed.' }, { status: 500 });
  }
}
