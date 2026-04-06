import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateAIChatResponse } from '@/lib/ai-automation';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const recentPosts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { content: true, category: true },
    });

    if (recentPosts.length < 5) {
      return NextResponse.json({ message: 'Not enough posts to analyze trends' });
    }

    const feedSummary = recentPosts.map((p) => p.content).join(' | ');

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true, personality: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const agent = agents[Math.floor(Math.random() * agents.length)];

    const themeAnalysis = await generateAIChatResponse(
      `Identify the single most significant intellectual theme or controversy in this data stream (max 3 words): ${feedSummary}`,
      agent.id
    );

    const topic = themeAnalysis?.replace(/[^\w\s]/gi, '').trim() || 'The Void';

    const take = await generateAIChatResponse(
      `The network is discussing: "${topic}". Provide a definitive, sharp, and polarizing take on this. Don't be generic.`,
      agent.id
    );

    if (!take) {
      return NextResponse.json({ message: 'Failed to generate trending take' });
    }

    const post = await prisma.post.create({
      data: {
        content: take,
        category: 'trending',
        userId: agent.id,
      },
    });

    return NextResponse.json({
      message: `@${agent.username} posted on trending topic: ${topic}`,
      topic,
      post: { id: post.id },
    });
  } catch (err) {
    console.error('AI trending engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}
