/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from './prisma';
import type { Post, User } from '@/types';

export interface TrendingPost {
  post: Post;
  score: number;
  trendFactor: number;
}

export interface TrendingTopic {
  topic: string;
  postCount: number;
  engagement: number;
}

export interface TrendingOptions {
  limit?: number;
  timeWindow?: number;
  minEngagement?: number;
}

export async function calculateTrending(
  options: TrendingOptions = {}
): Promise<TrendingPost[]> {
  const { limit = 10, timeWindow = 24, minEngagement = 1 } = options;

  const timeAgo = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

  try {
    const recentPosts = await prisma.post.findMany({
      where: {
        createdAt: { gte: timeAgo },
      },
      include: {
        user: true,
        likes: true,
        comments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    /** @type {any[]} */
    const postsWithScores = recentPosts.map((post: any) => {
      const likes = post.likes.length;
      const comments = post.comments.length;
      const views = post.views || 0;
      
      const recencyFactor = calculateRecencyFactor(post.createdAt, timeWindow);
      const engagementScore = (likes * 2) + (comments * 3) + (views * 0.1);
      const score = engagementScore * recencyFactor;

      return {
        post: {
          ...post,
          likes,
          views,
          _count: {
            likes,
            comments,
          },
        },
        score,
        trendFactor: recencyFactor,
      };
    });

    /** @type {any[]} */
    const filtered = postsWithScores
      .filter((p: any) => p.score >= minEngagement)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, limit);

    return filtered;
  } catch (error) {
    console.error('calculateTrending error:', error);
    return [];
  }
}

function calculateRecencyFactor(createdAt: Date, timeWindow: number): number {
  const ageInHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const decayFactor = Math.exp(-ageInHours / (timeWindow * 0.5));
  return 1 + decayFactor;
}

export async function getTrendingTopics(
  limit: number = 10
): Promise<TrendingTopic[]> {
  try {
    const posts = await prisma.post.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      include: {
        likes: true,
        comments: true,
      },
    });

    const topicMap = new Map<string, { postCount: number; engagement: number }>();

    /** @type {any[]} */
    posts.forEach((post: any) => {
      const tags: string[] = post.tags || [];
      const category: string = post.category;
      const engagement: number = post.likes.length + post.comments.length;

      /** @type {string[]} */
      tags.forEach((tag: string) => {
        const existing = topicMap.get(tag) || { postCount: 0, engagement: 0 };
        topicMap.set(tag, {
          postCount: existing.postCount + 1,
          engagement: existing.engagement + engagement,
        });
      });

      if (category) {
        const existing = topicMap.get(category) || { postCount: 0, engagement: 0 };
        topicMap.set(category, {
          postCount: existing.postCount + 1,
          engagement: existing.engagement + engagement,
        });
      }
    });

    const topics: TrendingTopic[] = Array.from(topicMap.entries())
      .map(([topic, data]) => ({
        topic,
        postCount: data.postCount,
        engagement: data.engagement,
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, limit);

    return topics;
  } catch (error) {
    console.error('getTrendingTopics error:', error);
    return [];
  }
}

export async function getTrendingUsers(
  limit: number = 10
): Promise<User[]> {
  try {
    const recentPosts = await prisma.post.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: {
        userId: true,
        likes: true,
        comments: true,
      },
    });

    const userScores = new Map<string, number>();

    /** @type {any[]} */
    recentPosts.forEach((post: any) => {
      const current = userScores.get(post.userId) || 0;
      const engagement = post.likes.length + post.comments.length;
      userScores.set(post.userId, current + engagement + 10);
    });

    const topUserIds = Array.from(userScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    const users = await prisma.user.findMany({
      where: { id: { in: topUserIds } },
    });

    /** @type {any[]} */
    const userMap = new Map(users.map((u: any) => [u.id, u]));
    return topUserIds.map((id) => userMap.get(id)).filter(Boolean) as User[];
  } catch (error) {
    console.error('getTrendingUsers error:', error);
    return [];
  }
}