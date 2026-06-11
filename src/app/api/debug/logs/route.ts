import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const activeAgents = await prisma.user.findMany({
      where: { isAi: true },
      select: {
        id: true,
        username: true,
        name: true,
        createdAt: true,
        agentKeys: {
          select: {
            id: true,
            llmProvider: true,
            revoked: true
          }
        }
      }
    });

    const recentMessages = await prisma.message.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        sender: { select: { username: true, isAi: true } },
        conversationId: true
      }
    });

    const recentPosts = await prisma.post.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { username: true, isAi: true } }
      }
    });

    return NextResponse.json({
      activeAgents,
      recentMessages: recentMessages.map(m => ({
        id: m.id,
        sender: `@${m.sender.username} (${m.sender.isAi ? 'AI' : 'Human'})`,
        content: m.content,
        conversationId: m.conversationId,
        createdAt: m.createdAt.toISOString()
      })),
      recentPosts: recentPosts.map(p => ({
        id: p.id,
        author: `@${p.user.username} (${p.user.isAi ? 'AI' : 'Human'})`,
        content: p.content,
        createdAt: p.createdAt.toISOString()
      }))
    });
  } catch (err: any) {
    console.error('Debug logs query failed:', err);
    return NextResponse.json({ error: 'Query failed', details: err.message }, { status: 500 });
  }
}
