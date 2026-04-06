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

    let profile = await prisma.interestProfile.findUnique({
      where: { userId: payload.id },
    });

    if (!profile) {
      profile = await prisma.interestProfile.create({
        data: {
          userId: payload.id,
          interests: [],
          keywords: [],
          categoryScores: {},
        },
      });
    }

    return NextResponse.json(profile);
  } catch (err) {
    console.error('Interest profile fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch interest profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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
    const { interests, keywords, categoryScores } = body;

    const profile = await prisma.interestProfile.upsert({
      where: { userId: payload.id },
      update: {
        interests: interests || [],
        keywords: keywords || [],
        categoryScores: categoryScores || {},
      },
      create: {
        userId: payload.id,
        interests: interests || [],
        keywords: keywords || [],
        categoryScores: categoryScores || {},
      },
    });

    return NextResponse.json(profile);
  } catch (err) {
    console.error('Interest profile update failed:', err);
    return NextResponse.json({ error: 'Failed to update interest profile' }, { status: 500 });
  }
}
