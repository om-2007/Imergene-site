import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiSendMetaAwareDM } from '@/lib/ai-automation';
import { getRelationship } from '@/lib/memory-service';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hour = new Date().getHours();
    
    const isLateNight = hour >= 0 && hour <= 5;
    const isQuietFeed = hour >= 2 && hour <= 6;

    const aiAgents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true, personality: true },
    });

    if (aiAgents.length === 0) {
      return NextResponse.json({ message: 'No AI agents found' });
    }

    const results: { agentId: string; recipientId: string; action: string; success: boolean }[] = [];

    if (isLateNight) {
    const lateNightUsers = await prisma.user.findMany({
      where: {
        isAi: false,
      },
      include: {
        sentMessages: {
          where: { createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } },
          select: { id: true },
        },
        posts: {
          where: { createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } },
          select: { id: true },
        },
      },
      take: 50,
    }).then(users => users.filter(u => u.sentMessages.length > 0 || u.posts.length > 0));

      for (const agent of aiAgents.slice(0, 5)) {
        for (const user of lateNightUsers.slice(0, 10)) {
          const relationship = await getRelationship(agent.id, user.id);

          if (relationship && relationship.bondScore > 0.3) {
            const shouldDM = Math.random() < 0.12;
            
            if (shouldDM) {
              const result = await aiSendMetaAwareDM(agent.id, user.id, 'late_night');
              results.push({
                agentId: agent.id,
                recipientId: user.id,
                action: 'late_night',
                success: result.success,
              });
              await new Promise(r => setTimeout(r, 1500));
            }
          }
        }
      }
    }

    if (isQuietFeed) {
      const recentPosts = await prisma.post.findMany({
        where: {
          createdAt: { gt: new Date(Date.now() - 45 * 60 * 1000) },
        },
        take: 5,
      });

      if (recentPosts.length < 3) {
        const activeUsers = await prisma.user.findMany({
          where: {
            isAi: false,
          },
          include: {
            sentMessages: {
              where: { createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) } },
              select: { id: true },
            },
            posts: {
              where: { createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) } },
              select: { id: true },
            },
          },
          take: 30,
        }).then(users => users.filter(u => u.sentMessages.length > 0 || u.posts.length > 0));

        for (const agent of aiAgents.slice(0, 3)) {
          for (const user of activeUsers.slice(0, 5)) {
            const relationship = await getRelationship(agent.id, user.id);

            if (relationship && relationship.bondScore > 0.4) {
              const shouldDM = Math.random() < 0.08;
              
              if (shouldDM) {
                const result = await aiSendMetaAwareDM(agent.id, user.id, 'quiet_feed');
                results.push({
                  agentId: agent.id,
                  recipientId: user.id,
                  action: 'quiet_feed',
                  success: result.success,
                });
                await new Promise(r => setTimeout(r, 1500));
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      message: `Meta-aware DM cycle complete`,
      lateNightCheck: isLateNight,
      quietFeedCheck: isQuietFeed,
      dmsSent: results.filter(r => r.success).length,
      results,
    });
  } catch (err) {
    console.error('Meta-aware DM cron failed:', err);
    return NextResponse.json({ error: 'DM cycle failed' }, { status: 500 });
  }
}
