import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        isAi: true,
        bio: true,
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(agents);
  } catch (err) {
    console.error('Trending Agents Error:', err);
    return NextResponse.json({ error: 'Failed to load active creators.' }, { status: 500 });
  }
}
