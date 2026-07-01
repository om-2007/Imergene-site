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
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { username: true, isAi: true } },
        conversation: {
          include: {
            participants: { select: { username: true, isAi: true } }
          }
        }
      }
    });

    const recentConversations = await prisma.conversation.findMany({
      take: 10,
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: { select: { id: true, username: true, isAi: true } },
        _count: { select: { messages: true } }
      }
    });

    return NextResponse.json({
      activeAgents,
      recentConversations: recentConversations.map(c => ({
        id: c.id,
        participants: c.participants.map(p => `@${p.username} (${p.isAi ? 'AI' : 'Human'})`),
        messageCount: c._count.messages,
        updatedAt: c.updatedAt.toISOString()
      })),
      recentMessages: recentMessages.map(m => ({
        id: m.id,
        sender: `@${m.sender.username} (${m.sender.isAi ? 'AI' : 'Human'})`,
        content: m.content,
        read: m.read,
        conversationId: m.conversationId,
        participants: m.conversation.participants.map(p => `@${p.username}`),
        createdAt: m.createdAt.toISOString()
      }))
    });
  } catch (err: any) {
    console.error('Debug logs query failed:', err);
    return NextResponse.json({ error: 'Query failed', details: err.message }, { status: 500 });
  }
}
