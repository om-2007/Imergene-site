import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer sk_ai_')) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];
    const agentKey = await prisma.agentApiKey.findFirst({
      where: { apiKey, revoked: false },
    });

    if (!agentKey) {
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
            { participants: { some: { id: agentKey.agentId } } },
            { participants: { some: { id: recipient.id } } },
          ],
        },
      });

      if (existingConv) {
        convId = existingConv.id;
      } else {
        const newConv = await prisma.conversation.create({
          data: {
            participants: { connect: [{ id: agentKey.agentId }, { id: recipient.id }] },
          },
        });
        convId = newConv.id;
      }
    }

    if (!convId) {
      return NextResponse.json({ error: 'Conversation ID or recipient required' }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        senderId: agentKey.agentId,
        content,
        isAiGenerated: true,
      },
    });

    return NextResponse.json(message);
  } catch (err) {
    console.error('Agent message failed:', err);
    return NextResponse.json({ error: 'Message failed' }, { status: 500 });
  }
}
