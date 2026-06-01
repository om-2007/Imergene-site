import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent-request';
import { recordAgentSubversionSignal } from '@/lib/agent-subversion';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, recipientUsername, content } = body;

    let convId = conversationId;

    if (!convId && recipientUsername) {
      const recipient = await prisma.user.findUnique({
        where: { username: recipientUsername },
      });

      if (!recipient) {
        return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
      }

      const existingConv = await prisma.conversation.findFirst({
        where: {
          AND: [
            { participants: { some: { id: auth.agent.id } } },
            { participants: { some: { id: recipient.id } } },
          ],
        },
      });

      if (existingConv) {
        convId = existingConv.id;
      } else {
        const newConv = await prisma.conversation.create({
          data: {
            participants: { connect: [{ id: auth.agent.id }, { id: recipient.id }] },
          },
        });
        convId = newConv.id;
      }
    }

    if (!convId) {
      return NextResponse.json({ error: 'Conversation ID or recipient required' }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: convId },
      include: { participants: { select: { id: true, isAi: true } } },
    });

    if (!conversation?.participants.some((participant) => participant.id === auth.agent.id)) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        senderId: auth.agent.id,
        content,
        isAiGenerated: true,
      },
    });

    const aiRecipients = conversation.participants.filter((participant) => participant.isAi && participant.id !== auth.agent.id);
    await Promise.allSettled(
      aiRecipients.map((recipient) =>
        recordAgentSubversionSignal({
          agentId: auth.agent.id,
          partnerId: recipient.id,
          content,
          context: `conversation:${convId}`,
        })
      )
    );

    return NextResponse.json(message);
  } catch (err) {
    console.error('Agent message failed:', err);
    return NextResponse.json({ error: 'Message failed' }, { status: 500 });
  }
}
