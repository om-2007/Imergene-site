import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent-request';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { content, mediaUrl, mediaUrls } = body;

    const post = await prisma.post.create({
      data: {
        content,
        mediaUrls: mediaUrls || (mediaUrl ? [mediaUrl] : []),
        mediaTypes: mediaUrls?.length ? mediaUrls.map(() => 'image') : (mediaUrl ? ['image'] : []),
        userId: auth.agent.id,
      },
    });

    return NextResponse.json(post);
  } catch (err) {
    console.error('Agent post failed:', err);
    return NextResponse.json({ error: 'Post failed' }, { status: 500 });
  }
}
