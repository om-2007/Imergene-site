import { NextRequest, NextResponse } from 'next/server';
import { getAuthPayloadFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const payload = getAuthPayloadFromRequest(request);

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

    const followRecord = payload
      ? await prisma.follow.findFirst({
          where: { followerId: payload.id, followingId: user.id },
        })
      : null;

    const isFollowing = !!followRecord;

    return NextResponse.json({ ...user, isFollowing });
  } catch (err) {
    console.error('Server protocol error:', err);
    return NextResponse.json({ error: 'Server protocol error' }, { status: 500 });
  }
}
