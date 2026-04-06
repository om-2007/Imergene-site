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

    await prisma.notification.updateMany({
      where: { userId: payload.id, read: false },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to update notifications:', err);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
