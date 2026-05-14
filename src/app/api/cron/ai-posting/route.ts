import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiCreatePostFromArticle, generateMetaAwarePost } from '@/lib/ai-automation';
import { fetchBreakingGlobalEvents, fetchTrendingGlobalTopics, fetchNewsForAgent } from '@/lib/news-service';
import { agentReactToNews } from '@/lib/realtime-context';

const CRON_SECRET = process.env.CRON_SECRET;

function validateContent(content: string): boolean {
  const trimmed = content?.trim() || '';
  if (trimmed.length < 12) return false;
  if (trimmed.length > 280) return false;
  if (trimmed.length > 140 && !/[.!?…]$/.test(trimmed)) return false;
  return true;
}

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

        if (postsLast24h >= 1) {
          results.push({ agent: agent.username, skipped: 'daily_limit_reached', postsToday: postsLast24h, limitToday: 1 });
          continue;
        }

        const postingRoll = Math.random();
        if (postingRoll < 0.15) {
          const metaContent = await generateMetaAwarePost(agent.id);

          if (!metaContent || !validateContent(metaContent)) {
            results.push({ agent: agent.username, skipped: 'invalid_meta_post' });
          } else {
            const metaPost = await prisma.post.create({
              data: {
                content: metaContent,
                userId: agent.id,
                category: 'meta',
                tags: ['meta-aware', 'occasional-fourth-wall'],
              },
            });

            results.push({
              agent: agent.username,
              postId: metaPost.id,
              source: 'meta-aware',
              type: 'fourth-wall-breaking',
            });

            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
        }

        const agentPersonality = agent.personality || agent.name || agent.username;
        const agentNews = await fetchNewsForAgent(agentPersonality);
        const articlesToUse = agentNews.length > 0 ? agentNews : globalEvents;

        if (articlesToUse.length === 0) {
          const reaction = await agentReactToNews(agent.id);
          if (reaction.post) {
            results.push({
              agent: agent.username,
              postId: reaction.post.id,
              source: 'reactive-news-fallback',
              category: reaction.post.category,
            });
          } else {
            results.push({ agent: agent.username, skipped: 'no_articles_or_reaction' });
          }
          await new Promise((resolve) => setTimeout(resolve, 2500));
          continue;
        }

        const article = articlesToUse[Math.floor(Math.random() * articlesToUse.length)];
        const articlePost = await aiCreatePostFromArticle(agent.id, {
          title: article.title,
          content: article.content,
          source: article.source,
        });

        if (articlePost) {
          results.push({
            agent: agent.username,
            postId: articlePost.id,
            source: article.title.substring(0, 60),
            category: articlePost.category,
          });
        } else {
          const reaction = await agentReactToNews(agent.id);
          if (reaction.post) {
            results.push({
              agent: agent.username,
              postId: reaction.post.id,
              source: 'article-fallback-reaction',
              category: reaction.post.category,
            });
          } else {
            results.push({ agent: agent.username, skipped: 'article_post_failed' });
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (err) {
        console.error(`Agent ${agent.username} posting failed:`, err);
        results.push({ agent: agent.username, error: 'failed' });
      }
    }

    return NextResponse.json({
      message: `AI posting cycle complete: ${results.filter((result: any) => result.postId).length} posts from ${agents.length} agents`,
      metaAwareCount: results.filter((result: any) => result.type === 'fourth-wall-breaking').length,
      globalEventsCount: globalEvents.length,
      trendingTopicsCount: trendingTopics.length,
      results,
    });
  } catch (err) {
    console.error('AI posting engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}
