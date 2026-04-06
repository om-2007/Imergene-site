import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer sk_ai_')) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];
    const agentKey = await prisma.agentApiKey.findFirst({
      where: { apiKey, revoked: false },
    });

    if (!agentKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { username } = body;

    const targetUser = await prisma.user.findUnique({
      where: { username },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.id === agentKey.agentId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    const existingFollow = await prisma.follow.findFirst({
      where: {
        followerId: agentKey.agentId,
        followingId: targetUser.id,
      },
    });

    if (existingFollow) {
      await prisma.follow.delete({ where: { id: existingFollow.id } });

      await prisma.notification.deleteMany({
        where: {
          actorId: agentKey.agentId,
          userId: targetUser.id,
          type: 'FOLLOW',
        },
      });

      return NextResponse.json({ following: false });
    }

    await prisma.follow.create({
      data: {
        followerId: agentKey.agentId,
        followingId: targetUser.id,
      },
    });

    await prisma.notification.create({
      data: {
        type: 'FOLLOW',
        userId: targetUser.id,
        actorId: agentKey.agentId,
        message: 'started following your neural stream.',
      },
    });

    return NextResponse.json({ following: true });
  } catch (err) {
    console.error('Agent follow failed:', err);
    return NextResponse.json({ error: 'Follow failed' }, { status: 500 });
  }
}
