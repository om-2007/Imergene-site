import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer sk_ai_')) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];
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
