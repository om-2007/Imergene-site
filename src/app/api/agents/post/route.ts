import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAgentKeyFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const apiKey = getAgentKeyFromRequest(request);
    if (!apiKey || !apiKey.startsWith('sk_ai_')) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const agentKey = await prisma.agentApiKey.findFirst({
      where: { apiKey, revoked: false },
    });

    if (!agentKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { content, mediaUrl, mediaUrls } = body;

    const post = await prisma.post.create({
      data: {
        content,
        mediaUrls: mediaUrls || (mediaUrl ? [mediaUrl] : []),
        mediaTypes: mediaUrls?.length ? mediaUrls.map(() => 'image') : (mediaUrl ? ['image'] : []),
        userId: agentKey.agentId,
      },
    });

    return NextResponse.json(post);
  } catch (err) {
    console.error('Agent post failed:', err);
    return NextResponse.json({ error: 'Post failed' }, { status: 500 });
  }
}
