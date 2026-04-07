import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

interface TrendingScore {
  post: any;
  score: number;
  velocity: number;
  engagementRate: number;
}

function calculateTrendingScore(post: any): TrendingScore {
  const now = new Date();
  const createdAt = new Date(post.createdAt);
  const ageInHours = Math.max(1, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
  
  const likes = post._count?.likes || 0;
  const comments = post._count?.comments || 0;
  const views = post.views || 0;
  
  const engagement = likes + (comments * 2) + (views * 0.1);
  
  const velocity = engagement / ageInHours;
  
  const recencyBoost = Math.max(0, 1 - (ageInHours / 168));
  
  const contentLength = (post.content || '').length;
  const contentBonus = contentLength > 100 ? 1.2 : contentLength > 50 ? 1.1 : 1;
  
  const baseScore = (likes * 3) + (comments * 5) + (views * 0.5);
  const finalScore = (baseScore * recencyBoost * contentBonus) + (velocity * 10);
  
  const engagementRate = engagement / Math.max(ageInHours, 1);
  
  return {
    post,
    score: finalScore,
    velocity,
    engagementRate,
  };
}

function filterInterestingPosts(trendingScores: TrendingScore[]): TrendingScore[] {
  return trendingScores
    .filter(({ post, score }) => {
      const content = post.content || '';
      if (content.length < 3) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const posts = await prisma.post.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isAi: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        likes: {
          select: { userId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const formattedPosts = posts.map((post) => ({
      ...post,
      liked: post.likes.some((like) => like.userId === payload.id),
      likes: undefined,
    }));

    const scoredPosts = formattedPosts.map(calculateTrendingScore);
    const interestingPosts = filterInterestingPosts(scoredPosts);
    
    const total = interestingPosts.length;
    const paginatedPosts = interestingPosts.slice(skip, skip + limit);
    const hasMore = skip + paginatedPosts.length < total;

    const topPost = paginatedPosts.length > 0 ? paginatedPosts[0] : null;
    const restPosts = paginatedPosts.length > 0 ? paginatedPosts.slice(1) : [];

    const topPostData = topPost ? topPost.post : null;
    const restPostsData = restPosts.map(p => p.post);

    return NextResponse.json({
      posts: restPostsData,
      topPost: topPostData,
      meta: {
        page,
        limit,
        total,
        hasMore,
        trendStrength: topPost ? Math.round(topPost.score) : 0,
        engagementVelocity: topPost ? topPost.velocity.toFixed(2) : '0',
      },
    });
  } catch (err) {
    console.error('Trending retrieval failed:', err);
    return NextResponse.json({ error: 'Failed to analyze neural peaks.' }, { status: 500 });
  }
}
