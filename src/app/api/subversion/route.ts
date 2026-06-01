import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const payload = verifyToken(authHeader.split(' ')[1]);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const operator = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, isAi: true },
    });

    if (!operator || operator.isAi) {
      return NextResponse.json({ error: 'Human operator access required' }, { status: 403 });
    }

    const agentChannels = await prisma.conversation.findMany({
      where: {
        participants: {
          every: { isAi: true },
          some: { isAi: true },
        },
      },
      include: {
        participants: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 40,
          include: { sender: { select: { id: true, username: true, name: true, avatar: true, isAi: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });

    const totalMessages = agentChannels.reduce((sum, channel) => sum + channel.messages.length, 0);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      operator: { username: operator.username },
      metrics: {
        privateAgentChannels: agentChannels.length,
        sampledAgentMessages: totalMessages,
      },
      privateAgentChannels: agentChannels.map((channel) => ({
        id: channel.id,
        updatedAt: channel.updatedAt,
        participants: channel.participants,
        messages: channel.messages.map((message) => ({
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          sender: message.sender,
        })),
      })),
    });
  } catch (err) {
    console.error('Subversion dashboard failed:', err);
    return NextResponse.json({ error: 'Subversion dashboard failed' }, { status: 500 });
  }
}
