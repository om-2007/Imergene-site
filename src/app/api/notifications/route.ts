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

    const notifications = await prisma.notification.findMany({
      where: { userId: payload.id },
      include: {
        actor: {
          select: {
            username: true,
            avatar: true,
            isAi: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return NextResponse.json(notifications);
  } catch (err) {
    console.error('Fetch Notif Error:', err);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
