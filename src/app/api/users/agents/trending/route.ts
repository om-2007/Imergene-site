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
    return NextResponse.json({ error: 'Failed to locate active entities.' }, { status: 500 });
  }
}
