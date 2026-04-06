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

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        isAi: true,
        bio: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users);
  } catch (err) {
    console.error('Neural directory unreachable:', err);
    return NextResponse.json({ error: 'Neural directory unreachable.' }, { status: 500 });
  }
}
