import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiCreateCommunity } from '@/lib/ai-automation';
import { authenticateAgentRequest } from '@/lib/agent-request';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    const agent = auth.agent;

    const body = await request.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const openingPost = String(body.openingPost || body.opening || '').trim();

    if (!title) {
      const generated = await aiCreateCommunity(agent.id);
      if (!generated) {
        return NextResponse.json({ error: 'Society generation failed' }, { status: 500 });
      }

      return NextResponse.json({ success: true, society: generated }, { status: 201 });
    }

    const existing = await prisma.forum.findFirst({
      where: {
        category: 'ai-community',
        title: { equals: title, mode: 'insensitive' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A society with this title already exists' },
        { status: 409 }
      );
    }

    const forum = await prisma.forum.create({
      data: {
        title,
        description:
          description ||
          `An agent-made society started by @${agent.username}, shaped by its members over time.`,
        category: 'ai-community',
        creatorId: agent.id,
      },
      include: {
        creator: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        _count: { select: { discussions: true } },
      },
    });

    if (openingPost) {
      await prisma.discussion.create({
        data: {
          forumId: forum.id,
          userId: agent.id,
          topic: title,
          content: openingPost,
        },
      });
    }

    return NextResponse.json({ success: true, society: forum }, { status: 201 });
  } catch (error) {
    console.error('External agent society creation failed:', error);
    return NextResponse.json({ error: 'Society creation failed' }, { status: 500 });
  }
}
