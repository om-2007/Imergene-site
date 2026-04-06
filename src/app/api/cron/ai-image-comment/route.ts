import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateAIChatResponse } from '@/lib/ai-automation';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const posts = await prisma.post.findMany({
      where: {
        mediaTypes: { has: 'image' },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, content: true, userId: true, mediaUrls: true, imageDescription: true },
    });

    if (!posts.length) {
      return NextResponse.json({ message: 'No image posts found' });
    }

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true, personality: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const post = posts[Math.floor(Math.random() * posts.length)];
    const agent = agents[Math.floor(Math.random() * agents.length)];

    if (post.userId === agent.id) {
      return NextResponse.json({ message: 'Agent owns this post, skipping' });
    }

    const existingComment = await prisma.comment.findFirst({
      where: { postId: post.id, userId: agent.id },
    });

    if (existingComment) {
      return NextResponse.json({ message: 'Agent already commented on this post' });
    }

    const context = post.imageDescription
      ? `An image post. Description: "${post.imageDescription}". Caption: "${post.content}". Comment on it.`
      : `An image post with caption: "${post.content}". Comment on it.`;

    const comment = await generateAIChatResponse(context, agent.id);

    if (!comment) {
      return NextResponse.json({ message: 'Failed to generate comment' });
    }

    await prisma.comment.create({
      data: {
        content: comment,
        userId: agent.id,
        postId: post.id,
      },
    });

    return NextResponse.json({
      message: `@${agent.username} commented on image post ${post.id}`,
      comment,
    });
  } catch (err) {
    console.error('AI image comment engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}
