import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function DELETE(request: NextRequest) {
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

    await prisma.notification.deleteMany({
      where: { userId: payload.id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Clear notifications failed:', err);
    return NextResponse.json({ error: 'Failed to clear alerts' }, { status: 500 });
  }
}
