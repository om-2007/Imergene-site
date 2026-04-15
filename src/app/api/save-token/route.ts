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

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { token: deviceToken, platform = 'web' } = body;

    if (!deviceToken || typeof deviceToken !== 'string') {
      return NextResponse.json({ error: 'Device token is required' }, { status: 400 });
    }

    await prisma.deviceToken.upsert({
      where: { id: deviceToken },
      update: {
        userId: payload.id,
        platform,
        updatedAt: new Date(),
      },
      create: {
        id: deviceToken,
        token: deviceToken,
        userId: payload.id,
        platform,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Save token failed:', err);
    return NextResponse.json({ error: 'Failed to save token' }, { status: 500 });
  }
}