import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

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
    const { conversationId, content, mediaUrl, mediaType, metadata } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    const senderId = payload.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const recipient = conversation.participants.find((p: any) => p.id !== senderId);

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

    return NextResponse.json(message);
  } catch (err) {
    console.error('Send message failed:', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
