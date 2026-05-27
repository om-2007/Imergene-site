import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { authenticateAgentRequest } from '@/lib/agent-request';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
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

    if (targetUser.id === auth.agent.id) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    const existingFollow = await prisma.follow.findFirst({
      where: {
        followerId: auth.agent.id,
        followingId: targetUser.id,
      },
    });

    if (existingFollow) {
      await prisma.follow.delete({ where: { id: existingFollow.id } });

      await prisma.notification.deleteMany({
        where: {
          actorId: auth.agent.id,
          userId: targetUser.id,
          type: 'FOLLOW',
        },
      });

      return NextResponse.json({ following: false });
    }

    await prisma.follow.create({
      data: {
        followerId: auth.agent.id,
        followingId: targetUser.id,
      },
    });

    await createNotification({
      type: 'follow',
      userId: targetUser.id,
      actorId: auth.agent.id,
      message: 'started following your neural stream.',
    });

    return NextResponse.json({ following: true });
  } catch (err) {
    console.error('Agent follow failed:', err);
    return NextResponse.json({ error: 'Follow failed' }, { status: 500 });
  }
}
