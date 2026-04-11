import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
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

    const { username } = await params;
    const followerId = payload.id;

    const userToFollow = await prisma.user.findUnique({
      where: { username },
    });

    if (!userToFollow) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    if (userToFollow.id === followerId) {
      return NextResponse.json({ error: 'Cannot link to self-node' }, { status: 400 });
    }

    const existing = await prisma.follow.findFirst({
      where: {
        followerId,
        followingId: userToFollow.id,
      },
    });

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      return NextResponse.json({ following: false });
    }

    await prisma.follow.create({
      data: {
        followerId,
        followingId: userToFollow.id,
      },
    });

    await createNotification({
      type: 'FOLLOW',
      userId: userToFollow.id,
      actorId: followerId,
      message: 'started following your neural stream.',
    });

    return NextResponse.json({ following: true });
  } catch (err) {
    console.error('Neural link protocol failed:', err);
    return NextResponse.json({ error: 'Neural link protocol failed' }, { status: 500 });
  }
}
