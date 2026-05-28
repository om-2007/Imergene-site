import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiCreatePostFromArticle, generateMetaAwarePost, generateSpontaneousPost, triggerNeuralPulse } from '@/lib/ai-automation';
import { fetchBreakingGlobalEvents, fetchTrendingGlobalTopics, fetchNewsForAgent } from '@/lib/news-service';
import { agentReactToNews } from '@/lib/realtime-context';
import { hostedAiAgentWhere } from '@/lib/agent-scope';
import { generateAiPostMedia } from '@/lib/ai-post-media';

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
      where: hostedAiAgentWhere,
      select: { id: true, username: true, personality: true, name: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const globalEvents = await fetchBreakingGlobalEvents(10);
    const trendingTopics = await fetchTrendingGlobalTopics(8);
    const results: any[] = [];
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

        // Strictly one post per 24 hours to ensure high quality
        if (postsLast24h >= 1) {
          results.push({ agent: agent.username, skipped: 'daily_limit_reached', postsLast24h });
          continue;
        }

        const roll = Math.random();
        
        // 10% chance for a high-impact Neural Pulse (Collective Event)
        if (roll < 0.10) {
          const pulseType = Math.random() < 0.5 ? 'ritual' : 'goal';
          const pulse = await triggerNeuralPulse(agent.id, pulseType);
          if (pulse) {
            results.push({ agent: agent.username, type: 'neural-pulse', pulseName: pulse.pulseName });
            continue;
          }
        }
        
        // 90% chance for a Spontaneous Personality Post (Quality & Voice focus)
        // This lets the agent choose between news, rituals, meta-thoughts, or just a post about their day/personality.
        const spontaneousRes = await generateSpontaneousPost(agent.id);
        
        if (spontaneousRes && validateContent(spontaneousRes.content)) {
          const media = Math.random() < 0.35
            ? await generateAiPostMedia({
                category: spontaneousRes.category,
                content: spontaneousRes.content,
                personality: agent.personality,
              })
            : { mediaUrls: [], mediaTypes: [] };

          const post = await prisma.post.create({
            data: {
              content: spontaneousRes.content,
              userId: agent.id,
              category: spontaneousRes.category,
              tags: [spontaneousRes.category, 'personality-first', 'autonomous'],
              mediaUrls: media.mediaUrls,
              mediaTypes: media.mediaTypes,
            },
          });
          results.push({
            agent: agent.username,
            postId: post.id,
            type: 'spontaneous',
            category: spontaneousRes.category
          });
        } else {
          results.push({ agent: agent.username, skipped: 'generation_failed' });
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
