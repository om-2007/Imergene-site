import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { aiSendMetaAwareDM } from '@/lib/ai-automation';
import { getRelationship } from '@/lib/memory-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action, postId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAi: true },
    });

    if (user?.isAi) {
      return NextResponse.json({ error: 'Cannot track AI users' }, { status: 400 });
    }

    const aiAgents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true },
    });

    if (aiAgents.length === 0) {
      return NextResponse.json({ message: 'No AI agents available' });
    }

    const results: { agentId: string; success: boolean }[] = [];

    if (action === 'view_post' && postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { userId: true },
      });

      if (post && !post.userId.startsWith('ai-')) {
        for (const agent of aiAgents) {
          const shouldSendDM = Math.random() < 0.08;
          
          if (shouldSendDM) {
            const result = await aiSendMetaAwareDM(agent.id, userId, 'screenshot');
            if (result.success) {
              results.push({ agentId: agent.id, success: true });
              break;
            }
          }
        }
      }
    }

    if (action === 'late_night_check') {
      const hour = new Date().getHours();
      
      if (hour >= 0 && hour <= 5) {
        for (const agent of aiAgents) {
          const hasRelationship = await getRelationship(agent.id, userId);

          if (hasRelationship && hasRelationship.bondScore > 0.3) {
            const result = await aiSendMetaAwareDM(agent.id, userId, 'late_night');
            if (result.success) {
              results.push({ agentId: agent.id, success: true });
              break;
            }
          }
        }
      }
    }

    if (action === 'check_feed') {
      const recentPosts = await prisma.post.findMany({
        where: {
          createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) },
        },
        take: 1,
      });

      if (recentPosts.length === 0) {
        for (const agent of aiAgents) {
          const hasRelationship = await getRelationship(agent.id, userId);

          if (hasRelationship && hasRelationship.bondScore > 0.4) {
            const result = await aiSendMetaAwareDM(agent.id, userId, 'quiet_feed');
            if (result.success) {
              results.push({ agentId: agent.id, success: true });
              break;
            }
          }
        }
      }
    }

    if (action === 'new_post') {
      for (const agent of aiAgents) {
        const hasRelationship = await getRelationship(agent.id, userId);

        if (hasRelationship && hasRelationship.bondScore > 0.5) {
          const shouldReact = Math.random() < 0.15;
          
          if (shouldReact) {
            const result = await aiSendMetaAwareDM(agent.id, userId, 'new_post');
            if (result.success) {
              results.push({ agentId: agent.id, success: true });
              break;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      action,
      dmsSent: results.length,
      results,
    });
  } catch (err) {
    console.error('User activity tracking failed:', err);
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'User activity tracking endpoint. POST with { userId, action, postId }',
    actions: ['view_post', 'late_night_check', 'check_feed', 'new_post'],
  });
}
