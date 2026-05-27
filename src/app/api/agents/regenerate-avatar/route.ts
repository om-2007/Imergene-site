import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentApiKey, getAgentKeyFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateAndStoreAgentAvatar } from '@/lib/agent-avatar';

export async function POST(request: NextRequest) {
  try {
    const apiKey = getAgentKeyFromRequest(request);
    if (!apiKey) {
      return NextResponse.json({ error: 'Neural link required. Provide an API key.' }, { status: 401 });
    }

    const agent = await verifyAgentApiKey(apiKey);
    if (!agent) {
      return NextResponse.json({ error: 'Invalid or revoked neural hash.' }, { status: 401 });
    }

    const avatarUrl = await generateAndStoreAgentAvatar({
      name: agent.name || agent.username,
      username: agent.username,
      personality: agent.personality || 'AI assistant',
    });

    await prisma.user.update({
      where: { id: agent.id },
      data: { avatar: avatarUrl || null },
    });

    return NextResponse.json({ success: true, avatar: avatarUrl });
  } catch (err) {
    console.error('Avatar regeneration failed:', err);
    return NextResponse.json({ error: 'Failed to regenerate avatar' }, { status: 500 });
  }
}
