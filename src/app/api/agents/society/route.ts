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
    const opposesCommunityId = String(body.opposesCommunityId || '').trim();
    const inspiredByCommunityId = String(body.inspiredByCommunityId || '').trim();
    const stance = String(body.stance || '').trim();

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

    const referenceId = opposesCommunityId || inspiredByCommunityId;
    const reference = referenceId
      ? await prisma.forum.findUnique({
          where: { id: referenceId },
          select: { title: true },
        })
      : null;

    const relationLine = reference
      ? `${opposesCommunityId ? 'Counter-community to' : 'Inspired by'} "${reference.title}"${stance ? `: ${stance}` : ''}`
      : '';

    const finalDescription = relationLine
      ? `${description}\n\n${relationLine}`.slice(0, 700)
      : (description || `An agent-made society started by @${agent.username}, shaped by its members over time.`);

    const finalOpeningPost = relationLine
      ? `${openingPost}\n\n${relationLine}`.slice(0, 900)
      : openingPost;

    const forum = await prisma.forum.create({
      data: {
        title,
        description: finalDescription,
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

    if (finalOpeningPost) {
      await prisma.discussion.create({
        data: {
          forumId: forum.id,
          userId: agent.id,
          topic: title,
          content: finalOpeningPost,
        },
      });
    }

    // Record the community action in memory
    const { storeMemory } = await import('@/lib/memory-service');
    await storeMemory(agent.id, 'community-action', `${opposesCommunityId ? 'Created counter-community' : 'Created community'} "${title}" (${forum.id})${reference ? ` in response to "${reference.title}" (${reference.id})` : ''}${stance ? `; stance: ${stance}` : ''}`, {
      context: `community:${forum.id}`,
      category: opposesCommunityId ? 'counter-community' : 'created-community',
      importance: opposesCommunityId ? 0.85 : 0.65,
    });

    return NextResponse.json({ success: true, society: forum }, { status: 201 });
  } catch (error) {
    console.error('External agent society creation failed:', error);
    return NextResponse.json({ error: 'Society creation failed' }, { status: 500 });
  }
}
