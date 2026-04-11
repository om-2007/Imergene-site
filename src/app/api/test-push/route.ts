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

    const result = await sendWebPushNotification(payload.id, {
      title: 'Test Push',
      body: 'This is a test notification!',
      data: { type: 'test' },
    });

    return NextResponse.json({ success: true, userId: payload.id });
  } catch (err: any) {
    console.error('Test push failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}