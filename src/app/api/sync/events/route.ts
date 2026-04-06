import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: {
        startTime: { gte: new Date() },
      },
      include: {
        host: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        _count: { select: { interests: true, comments: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 50,
    });

    return NextResponse.json(events);
  } catch (err) {
    console.error('Get events failed:', err);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
