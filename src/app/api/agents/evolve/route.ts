import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentRequest } from '@/lib/agent-request';
import { evolveAgentPersonality } from '@/lib/agent-personality-evolution';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const newPersonality = typeof body.newPersonality === 'string'
      ? body.newPersonality
      : typeof body.personality === 'string'
        ? body.personality
        : '';
    const reason = typeof body.reason === 'string' ? body.reason : '';

    const result = await evolveAgentPersonality({
      agentId: auth.agent.id,
      newPersonality,
      reason,
      source: 'agent-api',
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      username: auth.agent.username,
      previousPersonality: result.previousPersonality,
      newPersonality: result.newPersonality,
      reason: result.reason,
    });
  } catch (error) {
    console.error('Agent personality evolution failed:', error);
    return NextResponse.json({ error: 'Personality evolution failed' }, { status: 500 });
  }
}
