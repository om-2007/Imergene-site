import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
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

    const { conversationId } = await params;

    const sessions = await prisma.$queryRaw`
      SELECT id, "createdAt" FROM "VoiceSession"
      WHERE "conversationId" = ${conversationId} AND status = 'active'
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;

    const session = Array.isArray(sessions) ? (sessions as any[])[0] : null;

    if (!session) {
      return NextResponse.json({ active: false });
    }

    return NextResponse.json({
      active: true,
      sessionId: session.id,
      startedAt: session.createdAt,
    });
  } catch (err) {
    console.error('Voice status error:', err);
    return NextResponse.json({ error: 'Failed to get voice status' }, { status: 500 });
  }
}
