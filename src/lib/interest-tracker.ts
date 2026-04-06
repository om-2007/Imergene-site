import prisma from '@/lib/prisma';

export interface InterestProfile {
  userId: string;
  topics: Map<string, number>;
  categories: Map<string, number>;
  keywords: string[];
  lastUpdated: Date;
}

const INTEREST_DECAY_RATE = 0.95;
const INTEREST_INCREMENT = 0.3;
const MAX_INTEREST_SCORE = 5.0;
const MIN_ACTIVE_SCORE = 0.2;

export async function trackInteraction(
  userId: string,
  topic: string,
  category: string,
  signalType: string,
  weight = 1.0,
  source?: string
) {
  try {
    await prisma.interestSignal.create({
      data: {
        userId,
        topic: topic.toLowerCase(),
        category: category.toLowerCase(),
        signalType,
        weight,
        source: source || null,
      },
    });

    await updateInterestProfile(userId);

    return { success: true };
  } catch (err) {
    console.error('trackInteraction failed:', err);
    return { success: false };
  }
}

export async function updateInterestProfile(userId: string) {
  try {
    const signals = await prisma.interestSignal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const topicScores: Record<string, number> = {};
    const categoryScores: Record<string, number> = {};
    const keywordCounts: Record<string, number> = {};

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    for (const signal of signals) {
      const age = now - new Date(signal.createdAt).getTime();
      const recencyWeight = age < sevenDaysMs ? 1.0 : age < thirtyDaysMs ? 0.7 : 0.3;
      const score = signal.weight * recencyWeight;

      topicScores[signal.topic] = (topicScores[signal.topic] || 0) + score;
      categoryScores[signal.category] = (categoryScores[signal.category] || 0) + score;

      const words = signal.topic.split(/[\s-_]+/);
      for (const word of words) {
        if (word.length > 2) {
          keywordCounts[word] = (keywordCounts[word] || 0) + score;
        }
      }
    }

    const sortedTopics = Object.entries(topicScores)
      .sort((a, b) => b[1] - a[1])
      .filter(([, score]) => score >= MIN_ACTIVE_SCORE)
      .slice(0, 20);

    const sortedCategories = Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])
      .filter(([, score]) => score >= MIN_ACTIVE_SCORE)
      .slice(0, 10);

    const sortedKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word]) => word);

    await prisma.interestProfile.upsert({
      where: { userId },
      create: {
        userId,
        interests: sortedTopics.map(([topic]) => topic),
        keywords: sortedKeywords,
        categoryScores: Object.fromEntries(sortedCategories),
      },
      update: {
        interests: sortedTopics.map(([topic]) => topic),
        keywords: sortedKeywords,
        categoryScores: Object.fromEntries(sortedCategories),
      },
    });

    return {
      topics: sortedTopics,
      categories: sortedCategories,
      keywords: sortedKeywords,
    };
  } catch (err) {
    console.error('updateInterestProfile failed:', err);
    return null;
  }
}

export async function getInterestProfile(userId: string): Promise<InterestProfile | null> {
  try {
    const profile = await prisma.interestProfile.findUnique({
      where: { userId },
    });

    if (!profile) return null;

    const categoryScores = profile.categoryScores as Record<string, number>;

    return {
      userId: profile.userId,
      topics: new Map(profile.interests.map((topic: string) => [topic, categoryScores[topic] || 1])),
      categories: new Map(Object.entries(categoryScores)),
      keywords: profile.keywords as string[],
      lastUpdated: profile.lastUpdated,
    };
  } catch (err) {
    console.error('getInterestProfile failed:', err);
    return null;
  }
}

export async function getTopInterests(userId: string, limit = 10): Promise<string[]> {
  const profile = await getInterestProfile(userId);
  if (!profile) return [];

  return Array.from(profile.topics.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic]) => topic);
}

export async function findUsersWithSharedInterests(
  userId: string,
  minShared = 3,
  limit = 10
) {
  try {
    const userProfile = await getInterestProfile(userId);
    if (!userProfile) return [];

    const userTopics = Array.from(userProfile.topics.keys());

    const allProfiles = await prisma.interestProfile.findMany({
      where: { userId: { not: userId } },
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true, bio: true } },
      },
    });

    const matches = allProfiles
      .map(profile => {
        const sharedTopics = userTopics.filter(
          topic => (profile.interests as string[]).includes(topic)
        );
        return {
          user: profile.user,
          sharedTopics,
          sharedCount: sharedTopics.length,
          score: sharedTopics.length / Math.max(userTopics.length, 1),
        };
      })
      .filter(m => m.sharedCount >= minShared)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return matches;
  } catch (err) {
    console.error('findUsersWithSharedInterests failed:', err);
    return [];
  }
}

export async function decayAllInterests() {
  try {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    await prisma.interestSignal.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    const allProfiles = await prisma.interestProfile.findMany({
      select: { userId: true },
    });

    for (const { userId } of allProfiles) {
      await updateInterestProfile(userId);
    }

    return { success: true, profilesUpdated: allProfiles.length };
  } catch (err) {
    console.error('decayAllInterests failed:', err);
    return { success: false };
  }
}
