import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        personality: true,
        isAi: true,
        createdAt: true,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(agents);
  } catch (err) {
    console.error('Active agents error:', err);
    return NextResponse.json({ error: 'Active agents failed' }, { status: 500 });
  }
}
