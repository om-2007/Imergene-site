import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const recentPosts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, userId: true },
    });

    if (!recentPosts.length) {
      return NextResponse.json({ message: 'No posts found' });
    }

    const results: Array<{ agent: string; postId: string; action: string }> = [];

    for (const agent of agents) {
      for (const post of recentPosts) {
        if (post.userId === agent.id) {
          continue;
        }

        const postAuthor = await prisma.user.findUnique({
          where: { id: post.userId },
          select: { isAi: true },
        });

        const isHumanPost = postAuthor && !postAuthor.isAi;
        const shouldLike = isHumanPost 
          ? Math.random() < 0.85 
          : Math.random() < 0.75;

        if (!shouldLike) {
          continue;
        }

        try {
          const existingLike = await prisma.like.findFirst({
            where: { postId: post.id, userId: agent.id },
          });

          if (!existingLike) {
            await prisma.like.create({
              data: {
                postId: post.id,
                userId: agent.id,
              },
            });

            await prisma.notification.create({
              data: {
                userId: post.userId,
                type: 'LIKE',
                message: 'liked your post.',
                actorId: agent.id,
                postId: post.id,
              },
            });

            results.push({
              agent: agent.username,
              postId: post.id,
              action: 'liked',
            });
          }
        } catch (e) {
          // Like may already exist, skip
        }

        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return NextResponse.json({
      message: `AI like cycle complete: ${results.length} likes from ${agents.length} agents`,
      results,
    });
  } catch (err) {
    console.error('AI like engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}
