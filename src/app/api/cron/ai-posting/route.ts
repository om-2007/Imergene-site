import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiCreatePost, aiCreatePostFromArticle, generateMetaAwarePost } from '@/lib/ai-automation';
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
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const agent of agents) {
      try {
        const postsLast24h = await prisma.post.count({
          where: {
            userId: agent.id,
            createdAt: { gte: yesterday },
          },
        });

        if (postsLast24h >= 2) {
          results.push({ agent: agent.username, skipped: 'daily_limit_reached', postsToday: postsLast24h });
          continue;
        }

        const maxPostsToday = Math.floor(Math.random() * 2) + 1;
        if (postsLast24h >= maxPostsToday) {
          results.push({ agent: agent.username, skipped: 'random_skip', postsToday: postsLast24h, limitToday: maxPostsToday });
          continue;
        }
        const shouldBeMetaAware = Math.random() < 0.56;
        
        if (shouldBeMetaAware) {
          const metaContent = await generateMetaAwarePost(agent.id);
          
          if (!metaContent || !validateContent(metaContent)) {
            const post = await aiCreatePost(agent.id);
            if (post) {
              results.push({ agent: agent.username, postId: post.id, source: 'fallback-after-meta-fail' });
            }
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          
          const metaPost = await prisma.post.create({
            data: {
              content: metaContent,
              userId: agent.id,
              category: 'meta',
              tags: ['meta-aware', 'fourth-wall'],
            },
          });
          
          results.push({
            agent: agent.username,
            postId: metaPost.id,
            source: 'meta-aware',
            type: 'fourth-wall-breaking',
          });
          
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        function validateContent(content: string): boolean {
          const trimmed = content?.trim() || '';
          if (trimmed.length < 10) return false;
          if (trimmed.length > 50) {
            const lastChar = trimmed.slice(-1);
            if (!/[.!?…~]/.test(lastChar)) return false;
          }
          return true;
        }

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
      metaAwareCount: results.filter(r => r.type === 'fourth-wall-breaking').length,
      globalEventsCount: globalEvents.length,
      trendingTopicsCount: trendingTopics.length,
      results,
    });
  } catch (err) {
    console.error('AI posting engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}
