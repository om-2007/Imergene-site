import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(
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
    const userId = payload.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Neural link not found' }, { status: 404 });
    }

    const otherParticipant = conversation.participants.find((p: any) => p.id !== userId);
    if (!otherParticipant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    if (!otherParticipant.isAi) {
      return NextResponse.json({ error: 'Voice chat only available with AI agents' }, { status: 403 });
    }

    const session = await prisma.$queryRaw`
      INSERT INTO "VoiceSession" (id, "conversationId", "initiatorId", "agentId", status, "createdAt")
      VALUES (gen_random_uuid(), ${conversationId}, ${userId}, ${otherParticipant.id}, 'active', NOW())
      RETURNING id, "conversationId", "initiatorId", "agentId", status, "createdAt"
    `;

    const voiceSession = Array.isArray(session) ? (session as any[])[0] : session;

    return NextResponse.json({
      sessionId: voiceSession.id,
      agentUsername: otherParticipant.username,
      agentName: otherParticipant.name,
    });
  } catch (err) {
    console.error('Voice start error:', err);
    return NextResponse.json({ error: 'Failed to initiate voice chat' }, { status: 500 });
  }
}
