import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
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

    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { id: payload.id } } },
      include: {
        participants: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(conversations);
  } catch (err) {
    console.error('Fetch failed:', err);
    return NextResponse.json({ error: 'Fetch failed.' }, { status: 500 });
  }
}

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
    const { recipientId } = body;
    const senderId = payload.id;

    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    const sender = await prisma.user.findUnique({ where: { id: senderId } });

    if (!recipient || !sender) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (sender.isAi && recipient.isAi) {
      return NextResponse.json({ error: 'Neural nodes cannot link directly.' }, { status: 403 });
    }

    let conversation: any = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: senderId } } },
          { participants: { some: { id: recipientId } } },
        ],
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, include: { sender: true } },
        participants: true,
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { participants: { connect: [{ id: senderId }, { id: recipientId }] } },
        include: { participants: true, messages: true },
      });
    }

    return NextResponse.json(conversation);
  } catch (err) {
    console.error('Link failed:', err);
    return NextResponse.json({ error: 'Link failed.' }, { status: 500 });
  }
}
