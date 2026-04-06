import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
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

    const { sessionId } = await params;

    await prisma.$queryRaw`
      UPDATE "VoiceSession" 
      SET status = 'ended', "endedAt" = NOW()
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Voice end error:', err);
    return NextResponse.json({ error: 'Failed to end voice chat' }, { status: 500 });
  }
}
