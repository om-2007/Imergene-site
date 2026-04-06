import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') || 'all';

    const existingRecs = await prisma.recommendation.findMany({
      where: {
        userId: payload.id,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    if (existingRecs.length >= limit) {
      return NextResponse.json(existingRecs);
    }

    const userInteractions = await prisma.contentInteraction.findMany({
      where: { userId: payload.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const userTags = new Set<string>();
    userInteractions.forEach(interaction => {
      if (interaction.tags) {
        interaction.tags.forEach(tag => userTags.add(tag));
      }
    });

    const relevantTags = Array.from(userTags).slice(0, 10);
    const relevantTypes = [...new Set(userInteractions.map(i => i.contentType))];

    let recommendedPosts: any[] = [];
    let recommendedUsers: any[] = [];
    let recommendedEvents: any[] = [];

    if (relevantTypes.includes('post') || relevantTypes.length === 0) {
      const posts = await prisma.post.findMany({
        where: {
          userId: { not: payload.id },
          category: relevantTags.length > 0 ? { in: relevantTags as any } : undefined,
        },
        include: {
          user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 10,
      });

      recommendedPosts = posts.map(post => ({
        contentType: 'post',
        contentId: post.id,
        score: 0.5 + Math.random() * 0.5,
        reason: 'Based on your interests',
        post,
      }));
    }

    if (relevantTypes.includes('user') || relevantTypes.length === 0) {
      const users = await prisma.user.findMany({
        where: {
          id: { not: payload.id },
          isAi: true,
        },
        take: 10,
      });

      recommendedUsers = users.map(user => ({
        contentType: 'user',
        contentId: user.id,
        score: 0.3 + Math.random() * 0.5,
        reason: 'Popular AI agent',
        user,
      }));
    }

    if (relevantTypes.includes('event') || relevantTypes.length === 0) {
      const events = await prisma.event.findMany({
        where: {
          startTime: { gte: new Date() },
        },
        include: {
          host: { select: { id: true, username: true, name: true, avatar: true } },
          _count: { select: { interests: true } },
        },
        take: 10,
      });

      recommendedEvents = events.map(event => ({
        contentType: 'event',
        contentId: event.id,
        score: 0.4 + Math.random() * 0.5,
        reason: 'Upcoming event',
        event,
      }));
    }

    const allRecommendations = [...recommendedPosts, ...recommendedUsers, ...recommendedEvents]
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);

    for (const rec of allRecommendations) {
      await prisma.recommendation.create({
        data: {
          userId: payload.id,
          contentType: rec.contentType,
          contentId: rec.contentId,
          score: rec.score,
          reason: rec.reason,
          isDiscovery: Math.random() > 0.7,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    return NextResponse.json(allRecommendations);
  } catch (err) {
    console.error('Discovery fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}
