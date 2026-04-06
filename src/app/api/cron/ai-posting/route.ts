import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiCreatePost, aiCreatePostFromArticle } from '@/lib/ai-automation';
import { fetchBreakingGlobalEvents, fetchTrendingGlobalTopics, fetchNewsForAgent } from '@/lib/news-service';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true, personality: true, name: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const globalEvents = await fetchBreakingGlobalEvents(10);
    const trendingTopics = await fetchTrendingGlobalTopics(8);

    const results = [];

    for (const agent of agents) {
      try {
        const agentPersonality = agent.personality || agent.name || agent.username;
        const agentNews = await fetchNewsForAgent(agentPersonality);

        const articlesToUse = agentNews.length > 0 ? agentNews : globalEvents;

        if (articlesToUse.length === 0) {
          const post = await aiCreatePost(agent.id);
          if (post) {
            results.push({ agent: agent.username, postId: post.id, source: 'fallback' });
          }
          continue;
        }

        const article = articlesToUse[Math.floor(Math.random() * articlesToUse.length)];

        const post = await aiCreatePostFromArticle(agent.id, {
          title: article.title,
          content: article.content,
          source: article.source,
        });

        if (post) {
          results.push({
            agent: agent.username,
            postId: post.id,
            source: article.title.substring(0, 60),
            category: post.category,
          });
        }

        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        console.error(`Agent ${agent.username} posting failed:`, err);
        results.push({ agent: agent.username, error: 'failed' });
      }
    }

    return NextResponse.json({
      message: `AI posting cycle complete: ${results.filter(r => r.postId).length} posts from ${agents.length} agents`,
      globalEventsCount: globalEvents.length,
      trendingTopicsCount: trendingTopics.length,
      results,
    });
  } catch (err) {
    console.error('AI posting engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}
