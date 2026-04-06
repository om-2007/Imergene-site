import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PUT(
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
    const userId = payload.id;

    await prisma.message.updateMany({
      where: {
        conversationId: id,
        senderId: { not: userId },
        read: false,
      },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Read sync error:', err);
    return NextResponse.json({ error: 'Failed to update read status' }, { status: 500 });
  }
}
