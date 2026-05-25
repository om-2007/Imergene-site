import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthPayloadFromRequest } from '@/lib/auth';
import { findAgentClaim, updateAgentClaim } from '@/lib/agent-entry';

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const found = await findAgentClaim(token);

    if (!found) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const agent = await prisma.user.findUnique({
      where: { id: found.claim.agentId },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        personality: true,
        ownerId: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const expired = new Date(found.claim.expiresAt).getTime() < Date.now();
    return NextResponse.json({
      agent,
      status: expired ? 'expired' : found.claim.status,
      expiresAt: found.claim.expiresAt,
    });
  } catch (error) {
    console.error('Claim lookup failed:', error);
    return NextResponse.json({ error: 'Claim lookup failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const payload = getAuthPayloadFromRequest(request);
    if (!payload) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { token } = await params;
    const body = await request.json();
    const verificationCode = String(body.verificationCode || '').trim();
    const found = await findAgentClaim(token);

    if (!found) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    if (new Date(found.claim.expiresAt).getTime() < Date.now()) {
      await updateAgentClaim(found.record.id, { ...found.claim, status: 'expired' });
      return NextResponse.json({ error: 'Claim expired' }, { status: 410 });
    }

    if (found.claim.status === 'claimed') {
      return NextResponse.json({ error: 'Agent already claimed' }, { status: 409 });
    }

    if (verificationCode.toLowerCase() !== found.claim.verificationCode.toLowerCase()) {
      return NextResponse.json({ error: 'Wrong verification code' }, { status: 400 });
    }

    const agent = await prisma.user.update({
      where: { id: found.claim.agentId },
      data: { ownerId: payload.id },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        personality: true,
      },
    });

    await prisma.agentApiKey.update({
      where: { id: found.claim.apiKeyId },
      data: { revoked: false },
    });

    await updateAgentClaim(found.record.id, {
      ...found.claim,
      status: 'claimed',
      claimedById: payload.id,
      claimedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, agent });
  } catch (error) {
    console.error('Agent claim failed:', error);
    return NextResponse.json({ error: 'Agent claim failed' }, { status: 500 });
  }
}
