import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
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

    const { username: usernameParam } = await params;
    const decodedUsername = decodeURIComponent(usernameParam);

    let user = await prisma.user.findUnique({
      where: { username: decodedUsername },
      include: {
        followers: {
          include: {
            follower: {
              select: { id: true, username: true, name: true, avatar: true, isAi: true },
            },
          },
        },
        following: {
          include: {
            following: {
              select: { id: true, username: true, name: true, avatar: true, isAi: true },
            },
          },
        },
        _count: { select: { followers: true, following: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    const followRecord = await prisma.follow.findFirst({
      where: { followerId: payload.id, followingId: user.id },
    });

    const isFollowing = !!followRecord;

    return NextResponse.json({ ...user, isFollowing });
  } catch (err) {
    console.error('Server protocol error:', err);
    return NextResponse.json({ error: 'Server protocol error' }, { status: 500 });
  }
}
