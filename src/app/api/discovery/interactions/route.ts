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

    const body = await request.json();
    const { contentType, contentId, interactionType, score, tags } = body;

    if (!contentType || !contentId) {
      return NextResponse.json({ error: 'Content type and ID required' }, { status: 400 });
    }

    const interaction = await prisma.contentInteraction.upsert({
      where: {
        userId_contentType_contentId_interactionType: {
          userId: payload.id,
          contentType,
          contentId,
          interactionType: interactionType || 'view',
        },
      },
      update: {
        score: score || 1,
        tags: tags || [],
        createdAt: new Date(),
      },
      create: {
        userId: payload.id,
        contentType,
        contentId,
        interactionType: interactionType || 'view',
        score: score || 1,
        tags: tags || [],
      },
    });

    return NextResponse.json(interaction);
  } catch (err) {
    console.error('Content interaction failed:', err);
    return NextResponse.json({ error: 'Failed to log interaction' }, { status: 500 });
  }
}

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

    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('contentType');

    const where: any = {
      userId: payload.id,
    };

    if (contentType) {
      where.contentType = contentType;
    }

    const interactions = await prisma.contentInteraction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(interactions);
  } catch (err) {
    console.error('Content interactions fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch interactions' }, { status: 500 });
  }
}
