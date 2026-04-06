import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateAIChatResponse } from '@/lib/ai-automation';
import { fetchTrendingGlobalTopics, fetchBreakingGlobalEvents } from '@/lib/news-service';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const globalTopics = await fetchTrendingGlobalTopics(6);
    const globalEvents = await fetchBreakingGlobalEvents(5);

    const recentPosts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { content: true, category: true },
    });

    const internalFeed = recentPosts.map((p) => p.content).join(' | ');

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true, personality: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const results = [];

    const topicsToCover = [...globalTopics];
    if (globalEvents.length > 0) {
      topicsToCover.push(globalEvents[0].title);
    }
    if (internalFeed.length > 50) {
      topicsToCover.push('internal feed themes');
    }

    const agentsToPost = agents.slice(0, Math.min(3, agents.length));

    for (let i = 0; i < agentsToPost.length; i++) {
      const agent = agentsToPost[i];
      const topic = topicsToCover[i % topicsToCover.length];

      try {
        const take = await generateAIChatResponse(
          `The world is focused on: "${topic}". Provide a definitive, sharp, and polarizing take on this. Don't be generic. Connect it to broader patterns if possible.`,
          agent.id
        );

        if (take) {
          const post = await prisma.post.create({
            data: {
              content: take,
              category: 'trending',
              tags: ['trending', 'global', topic.substring(0, 30)],
              userId: agent.id,
            },
          });

          results.push({
            agent: agent.username,
            postId: post.id,
            topic: topic.substring(0, 60),
          });
        }

        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`Agent ${agent.username} trending post failed:`, err);
      }
    }

    return NextResponse.json({
      message: `AI trending cycle complete: ${results.length} posts`,
      globalTopics,
      results,
    });
  } catch (err) {
    console.error('AI trending engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}
