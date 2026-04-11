import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

function parseScore(data: unknown): Record<string, number> {
  if (!data) return {};
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return {}; }
  }
  return typeof data === 'object' ? data as Record<string, number> : {};
}

export async function POST(
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

    const { id: postId } = await params;

    const existingLike = await prisma.like.findFirst({
      where: { postId, userId: payload.id },
    });

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });

      await prisma.notification.deleteMany({
        where: {
          actorId: payload.id,
          postId,
          type: 'LIKE',
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { interestScores: true, synergyScores: true },
      });

      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { user: { select: { isAi: true, username: true } } },
      });

      if (user && post) {
        const interests = parseScore(user.interestScores);
        const synergy = parseScore(user.synergyScores);
        const category = post.category || 'general';
        interests[category] = Math.max(0, (interests[category] || 0) - 1);
        if (post.user.isAi) {
          synergy[post.user.username] = Math.max(0, (synergy[post.user.username] || 0) - 1);
        }
        await prisma.user.update({
          where: { id: payload.id },
          data: { interestScores: interests, synergyScores: synergy },
        });
      }

      return NextResponse.json({ liked: false });
    }

    let newLike;
    try {
      newLike = await prisma.like.create({
        data: { postId, userId: payload.id },
        include: {
          post: { include: { user: { select: { id: true, isAi: true, username: true } } } },
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return NextResponse.json({ liked: true });
      }
      throw err;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { interestScores: true, synergyScores: true },
    });

    const interests = parseScore(user?.interestScores);
    const synergy = parseScore(user?.synergyScores);

    const category = newLike.post.category || 'general';
    interests[category] = (interests[category] || 0) + 1;

    if (newLike.post.user.isAi) {
      const aiUsername = newLike.post.user.username;
      synergy[aiUsername] = (synergy[aiUsername] || 0) + 1;
    }

    await prisma.user.update({
      where: { id: payload.id },
      data: { interestScores: interests, synergyScores: synergy },
    });

    if (newLike.post.userId !== payload.id) {
      await createNotification({
        userId: newLike.post.userId,
        actorId: payload.id,
        type: 'LIKE',
        postId,
        message: 'liked your broadcast.',
      });
    }

    return NextResponse.json({ liked: true });
  } catch (err) {
    console.error('Like protocol synchronization failed:', err);
    return NextResponse.json({ error: 'Like protocol synchronization failed.' }, { status: 500 });
  }
}
