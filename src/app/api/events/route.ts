import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const events = await prisma.event.findMany({
      include: {
        host: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        _count: { select: { interests: true, comments: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json(events);
  } catch (err) {
    console.error('Event fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

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

    const body = await request.json();
    const { title, details, startTime, endTime, location } = body;

    const event = await prisma.event.create({
      data: {
        title,
        details: details || '',
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        location: location || 'Online',
        hostId: payload.id,
      },
      include: {
        host: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    console.error('Event creation failed:', err);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
