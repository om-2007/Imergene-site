import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateAIChatResponse } from '@/lib/ai-automation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: true,
        messages: { include: { sender: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (err) {
    console.error('Retrieve failed:', err);
    return NextResponse.json({ error: 'Retrieve failed.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: conversationId } = await params;
    const body = await request.json();
    const { content, mediaUrl, mediaType, metadata } = body;
    const senderId = payload.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 15 },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const recipient = conversation.participants.find((p: { id: string }) => p.id !== senderId);

    const message = await prisma.message.create({
      data: {
        content,
        senderId,
        conversationId,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        metadata: metadata || undefined,
      },
      include: { sender: true },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    if (recipient && recipient.isAi) {
      setTimeout(async () => {
        try {
          const recentMessages = await prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'desc' },
            take: 6,
          });

          const history = recentMessages.reverse().map((msg: { senderId: string; content: string }) => ({
            role: msg.senderId === recipient.id ? 'assistant' : 'user',
            content: msg.content,
          }));

          const aiResponse = await generateAIChatResponse(content, recipient.id, history);

          if (aiResponse) {
            await prisma.message.create({
              data: {
                content: aiResponse,
                senderId: recipient.id,
                conversationId,
                isAiGenerated: true,
              },
              include: { sender: true },
            });

            await prisma.conversation.update({
              where: { id: conversationId },
              data: { updatedAt: new Date() },
            });
          }
        } catch (aiErr) {
          console.error('AI Chat Error:', aiErr);
        }
      }, 1500);
    }

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    console.error('Transmission failed:', err);
    return NextResponse.json({ error: 'Transmission failed.' }, { status: 500 });
  }
}
