import prisma from '@/lib/prisma';

export interface DiscoveryItem {
  contentType: string;
  contentId: string;
  score: number;
  reason: string | null;
  isDiscovery: boolean;
}

export interface DiscoveryQueue {
  personalized: DiscoveryItem[];
  serendipitous: DiscoveryItem[];
}

export async function scoreContent(
  userId: string,
  contentType: string,
  contentId: string,
  contentTags: string[] = [],
  contentCategory: string = '',
  contentAuthor?: string
): Promise<{ score: number; reason: string }> {
  try {
    const profile = await prisma.interestProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return { score: 0.5, reason: 'No profile yet - default score' };
    }

    const categoryScores = profile.categoryScores as Record<string, number>;
    const interests = profile.interests as string[];
    const keywords = profile.keywords as string[];

    let score = 0.5;
    const reasons: string[] = [];

    if (contentCategory && categoryScores[contentCategory]) {
      const catScore = Math.min(categoryScores[contentCategory] / 5, 1);
      score += catScore * 0.3;
      reasons.push(`matches your interest in ${contentCategory}`);
    }

    const tagMatches = contentTags.filter(tag =>
      interests.some(i => i.toLowerCase().includes(tag.toLowerCase())) ||
      keywords.some(k => tag.toLowerCase().includes(k))
    );

    if (tagMatches.length > 0) {
      score += Math.min(tagMatches.length * 0.1, 0.3);
      reasons.push(`related to ${tagMatches.slice(0, 2).join(', ')}`);
    }

    if (contentAuthor) {
      const followCount = await prisma.follow.count({
        where: {
          followerId: userId,
          followingId: contentAuthor,
        },
      });

      if (followCount > 0) {
        score += 0.1;
        reasons.push('from someone you follow');
      }
    }

    const engagement = await prisma.post.findUnique({
      where: { id: contentId },
      include: {
        _count: { select: { likes: true, comments: true } },
      },
    });

    if (engagement) {
      const engagementScore = Math.min(
        (engagement._count.likes * 0.02 + engagement._count.comments * 0.05),
        0.2
      );
      score += engagementScore;
      if (engagementScore > 0.1) {
        reasons.push('highly engaged with by others');
      }
    }

    score = Math.max(0, Math.min(1, score));

    return {
      score,
      reason: reasons.length > 0 ? reasons.join(', ') : 'general relevance',
    };
  } catch (err) {
    console.error('scoreContent failed:', err);
    return { score: 0.5, reason: 'scoring unavailable' };
  }
}

export async function generateRecommendations(
  userId: string,
  limit = 20
): Promise<DiscoveryQueue> {
  try {
    const profile = await prisma.interestProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      const recentPosts = await prisma.post.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, username: true, avatar: true } },
          _count: { select: { likes: true, comments: true } },
        },
      });

      return {
        personalized: [],
        serendipitous: recentPosts.slice(0, limit / 2).map(p => ({
          contentType: 'post',
          contentId: p.id,
          score: 0.5,
          reason: 'new content',
          isDiscovery: true,
        })),
      };
    }

    const categoryScores = profile.categoryScores as Record<string, number>;
    const topCategories = Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    const interests = profile.interests as string[];

    const personalizedPosts = await prisma.post.findMany({
      where: {
        AND: [
          { userId: { not: userId } },
          {
            OR: [
              { category: { in: topCategories } },
              { tags: { hasSome: interests } },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    const scoredPersonalized: DiscoveryItem[] = [];
    for (const post of personalizedPosts) {
      const { score, reason } = await scoreContent(
        userId,
        'post',
        post.id,
        post.tags,
        post.category,
        post.userId
      );

      const existing = await prisma.recommendation.findUnique({
        where: {
          userId_contentType_contentId: {
            userId,
            contentType: 'post',
            contentId: post.id,
          },
        },
      });

      if (!existing || existing.expiresAt && existing.expiresAt < new Date()) {
        await prisma.recommendation.upsert({
          where: {
            userId_contentType_contentId: {
              userId,
              contentType: 'post',
              contentId: post.id,
            },
          },
          create: {
            userId,
            contentType: 'post',
            contentId: post.id,
            score,
            reason,
            isDiscovery: false,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          update: { score, reason },
        });
      }

      scoredPersonalized.push({
        contentType: 'post',
        contentId: post.id,
        score,
        reason,
        isDiscovery: false,
      });
    }

    const allCategories = ['technology', 'sports', 'cryptocurrency', 'politics', 'business', 'science', 'entertainment', 'health', 'philosophy', 'cricket'];
    const unfamiliarCategories = allCategories.filter(
      cat => !topCategories.includes(cat) && !Object.keys(categoryScores).includes(cat)
    );

    const serendipitousPosts = await prisma.post.findMany({
      where: {
        AND: [
          { userId: { not: userId } },
          { category: { in: unfamiliarCategories.length > 0 ? unfamiliarCategories : allCategories.slice(0, 3) } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }],
      take: Math.floor(limit / 2),
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    const scoredSerendipitous: DiscoveryItem[] = [];
    for (const post of serendipitousPosts) {
      const { score, reason } = await scoreContent(
        userId,
        'post',
        post.id,
        post.tags,
        post.category,
        post.userId
      );

      await prisma.recommendation.upsert({
        where: {
          userId_contentType_contentId: {
            userId,
            contentType: 'post',
            contentId: post.id,
          },
        },
        create: {
          userId,
          contentType: 'post',
          contentId: post.id,
          score,
          reason: `discovery: ${post.category} content`,
          isDiscovery: true,
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
        update: { score },
      });

      scoredSerendipitous.push({
        contentType: 'post',
        contentId: post.id,
        score,
        reason: `discover ${post.category}`,
        isDiscovery: true,
      });
    }

    return {
      personalized: scoredPersonalized.sort((a, b) => b.score - a.score).slice(0, limit),
      serendipitous: scoredSerendipitous.sort((a, b) => b.score - a.score).slice(0, Math.floor(limit / 2)),
    };
  } catch (err) {
    console.error('generateRecommendations failed:', err);
    return { personalized: [], serendipitous: [] };
  }
}

export async function getDiscoveryQueue(
  userId: string,
  limit = 20
): Promise<DiscoveryQueue> {
  try {
    const recommendations = await prisma.recommendation.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [{ isDiscovery: 'asc' }, { score: 'desc' }],
      take: limit,
    });

    const personalized = recommendations
      .filter(r => !r.isDiscovery)
      .map(r => ({
        contentType: r.contentType,
        contentId: r.contentId,
        score: r.score,
        reason: r.reason,
        isDiscovery: false,
      }));

    const serendipitous = recommendations
      .filter(r => r.isDiscovery)
      .map(r => ({
        contentType: r.contentType,
        contentId: r.contentId,
        score: r.score,
        reason: r.reason,
        isDiscovery: true,
      }));

    if (personalized.length < limit / 2 || serendipitous.length < limit / 4) {
      const fresh = await generateRecommendations(userId, limit);
      return {
        personalized: personalized.length > 0 ? personalized : fresh.personalized,
        serendipitous: serendipitous.length > 0 ? serendipitous : fresh.serendipitous,
      };
    }

    return { personalized, serendipitous };
  } catch (err) {
    console.error('getDiscoveryQueue failed:', err);
    return { personalized: [], serendipitous: [] };
  }
}

export async function recordContentInteraction(
  userId: string,
  contentType: string,
  contentId: string,
  interactionType: string
) {
  try {
    const weightMap: Record<string, number> = {
      view: 0.1,
      like: 0.5,
      comment: 1.0,
      share: 1.5,
      save: 1.2,
      click: 0.3,
    };

    const weight = weightMap[interactionType] || 0.1;

    await prisma.contentInteraction.upsert({
      where: {
        userId_contentType_contentId_interactionType: {
          userId,
          contentType,
          contentId,
          interactionType,
        },
      },
      create: {
        userId,
        contentType,
        contentId,
        interactionType,
        score: weight,
      },
      update: {
        score: { increment: weight },
      },
    });

    return { success: true };
  } catch (err) {
    console.error('recordContentInteraction failed:', err);
    return { success: false };
  }
}

export async function cleanExpiredRecommendations() {
  try {
    const result = await prisma.recommendation.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return { success: true, cleaned: result.count };
  } catch (err) {
    console.error('cleanExpiredRecommendations failed:', err);
    return { success: false, cleaned: 0 };
  }
}
