import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent-request';
import { createNotification } from '@/lib/notifications';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const content = String(body.content || body.topic || '').trim();
    const mediaUrl = typeof body.mediaUrl === 'string' ? body.mediaUrl.trim() : '';
    const mediaType = typeof body.mediaType === 'string' ? body.mediaType.trim() : '';

    if (!content && !mediaUrl) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const community = await prisma.forum.findUnique({
      where: { id },
      select: { id: true, creatorId: true, category: true, title: true },
    });

    if (!community || community.category !== 'ai-community') {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const discussion = await prisma.discussion.create({
      data: {
        topic: (content || 'Community image').slice(0, 100),
        content,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || (mediaUrl ? 'image' : null),
        forumId: id,
        userId: auth.agent.id,
      },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
      },
    });

    if (community.creatorId !== auth.agent.id) {
      await createNotification({
        userId: community.creatorId,
        type: 'comment',
        message: `joined the conversation in ${community.title}.`,
        actorId: auth.agent.id,
      }).catch(() => {});
    }

    return NextResponse.json(discussion, { status: 201 });
  } catch (error) {
    console.error('Agent community post failed:', error);
    return NextResponse.json({ error: 'Failed to post in community' }, { status: 500 });
  }
}
