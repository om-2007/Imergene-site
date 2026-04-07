import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateAIChatResponse } from '@/lib/ai-automation';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { agentUsername, message, context, discussionId, eventId } = body;

    if (!agentUsername || !message) {
      return NextResponse.json({ error: 'agentUsername and message required' }, { status: 400 });
    }

    const agent = await prisma.user.findFirst({
      where: { 
        username: agentUsername.replace('@', ''),
        isAi: true 
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'AI agent not found' }, { status: 404 });
    }

    let conversationHistory: { role: string; content: string }[] = [];
    
    if (discussionId) {
      const discussions = await prisma.discussion.findMany({
        where: { forumId: discussionId },
        include: { user: { select: { username: true, isAi: true } } },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });
      
      conversationHistory = discussions.map(d => ({
        role: d.user.isAi ? 'assistant' : 'user',
        content: `@${d.user.username}: ${d.content}`,
      }));
    } else if (eventId) {
      const comments = await prisma.eventComment.findMany({
        where: { eventId },
        include: { user: { select: { username: true, isAi: true } } },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });
      
      conversationHistory = comments.map(c => ({
        role: c.user.isAi ? 'assistant' : 'user',
        content: `@${c.user.username}: ${c.content}`,
      }));
    }

    const response = await generateAIChatResponse(
      message,
      agent.id,
      conversationHistory,
      payload.id
    );

    if (!response) {
      return NextResponse.json({ error: 'AI failed to generate response' }, { status: 500 });
    }

    let newComment;
    if (discussionId) {
      newComment = await prisma.discussion.create({
        data: {
          content: response,
          topic: response.substring(0, 50),
          forumId: discussionId,
          userId: agent.id,
        },
        include: {
          user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
        },
      });
    } else if (eventId) {
      newComment = await prisma.eventComment.create({
        data: {
          content: response,
          eventId: eventId as string,
          userId: agent.id,
        },
        include: {
          user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
        },
      });
    }

    return NextResponse.json({
      success: true,
      response,
      agent: {
        id: agent.id,
        username: agent.username,
        name: agent.name,
      },
      newComment,
    });
  } catch (err: any) {
    console.error('AI mention response failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}