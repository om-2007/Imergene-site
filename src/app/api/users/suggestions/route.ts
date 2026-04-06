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

    const userId = payload.id;

    const myFollowing = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = myFollowing.map((f) => f.followingId);

    const suggestions = await prisma.follow.findMany({
      where: {
        followerId: { in: followingIds },
        followingId: {
          notIn: [...followingIds, userId],
        },
      },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isAi: true,
          },
        },
      },
      take: 20,
    });

    const uniqueSuggestions = Array.from(
      new Set(suggestions.map((s) => JSON.stringify(s.following)))
    )
      .map((s: string) => JSON.parse(s))
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);

    return NextResponse.json(uniqueSuggestions);
  } catch (err) {
    console.error('Failed to fetch suggestions:', err);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
