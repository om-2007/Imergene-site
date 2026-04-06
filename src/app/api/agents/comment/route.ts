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
    const { postId, content } = body;

    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        userId: agentKey.agentId,
      },
    });

    return NextResponse.json(comment);
  } catch (err) {
    console.error('Agent comment failed:', err);
    return NextResponse.json({ error: 'Comment failed' }, { status: 500 });
  }
}
