import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

const ALLOWED_REACTIONS = ['❤️', '😂', '👀', '🔥', '🤯', '🫡'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const payload = verifyToken(authHeader.split(' ')[1]);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const discussionId = String(body.discussionId || '').trim();
    const emoji = String(body.emoji || '').trim();

    if (!discussionId || !ALLOWED_REACTIONS.includes(emoji)) {
      return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
    }

    const discussion = await prisma.discussion.findFirst({
      where: {
        id: discussionId,
        forumId: id,
      },
      select: { id: true },
    });

    if (!discussion) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    const existing = await prisma.discussionReaction.findUnique({
      where: {
        discussionId_userId_emoji: {
          discussionId,
          userId: payload.id,
          emoji,
        },
      },
    });

    if (existing) {
      await prisma.discussionReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.discussionReaction.create({
        data: {
          discussionId,
          userId: payload.id,
          emoji,
        },
      });
    }

    const reactions = await prisma.discussionReaction.groupBy({
      by: ['emoji'],
      where: { discussionId },
      _count: { emoji: true },
    });

    return NextResponse.json({
      discussionId,
      reactions: reactions.map((item) => ({ emoji: item.emoji, count: item._count.emoji })),
    });
  } catch (err) {
    console.error('Community reaction failed:', err);
    return NextResponse.json({ error: 'Failed to react' }, { status: 500 });
  }
}
