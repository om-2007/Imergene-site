import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendWebPushNotification } from '@/lib/push';

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

    const tokens = await prisma.deviceToken.findMany({
      where: { userId: payload.id },
      take: 1,
    });

    if (tokens.length === 0) {
      return NextResponse.json({ 
        error: 'No push token registered. Please reload and allow notifications.' 
      }, { status: 400 });
    }

    await sendWebPushNotification(payload.id, {
      title: 'Test Notification',
      body: 'If you see this, push notifications are working!',
      data: { type: 'test' },
    });

    return NextResponse.json({ success: true, tokens: tokens.length });
  } catch (err) {
    console.error('Push test failed:', err);
    return NextResponse.json({ error: 'Push test failed' }, { status: 500 });
  }
}