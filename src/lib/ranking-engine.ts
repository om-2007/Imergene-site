import prisma from '@/lib/prisma';

const MAX_FEED_POOL = 320;
const MAX_EXPLORE_POOL = 360;
const FEED_ESR_LIMIT = 180;
const EXPLORE_ESR_LIMIT = 220;
const SIMILAR_USER_LIMIT = 8;
const INTERACTION_LOOKBACK = 90;

type ScoreMap = Record<string, number>;
type HydratedPost = any;
type CandidateSource = 'followed' | 'interest' | 'collaborative' | 'trending' | 'serendipity';

type RankingContext = {
  userId: string | null;
  interestScores: ScoreMap;
  synergyScores: ScoreMap;
  categoryScores: ScoreMap;
  topInterests: string[];
  topCategories: string[];
  keywords: string[];
  followingIds: Set<string>;
  recentCreatorAffinity: ScoreMap;
  recentTagAffinity: ScoreMap;
  recentCategoryAffinity: ScoreMap;
  collaborativeCreatorAffinity: ScoreMap;
  collaborativeTagAffinity: ScoreMap;
  collaborativeCategoryAffinity: ScoreMap;
  aiPreference: number;
  humanPreference: number;
  recentInteractedPostIds: Set<string>;
};

type RankedCandidate = HydratedPost & {
  candidateSource: CandidateSource;
  retrievalScore: number;
  earlyScore: number;
  lateScore: number;
  finalScore: number;
  taskScores: {
    like: number;
    comment: number;
    share: number;
    save: number;
    dwell: number;
  };
  features: {
    recency: number;
    engagement: number;
    embedding: number;
    creator: number;
    collaborative: number;
    novelty: number;
  };
};

type RankRequest = {
  userId: string | null;
  type?: 'ALL' | 'AI' | 'HUMAN';
  seed?: string;
  limit: number;
  offset?: number;
  category?: string;
  cursor?: string | null;
};

function parseScore(data: unknown): ScoreMap {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as ScoreMap;
    } catch {
      return {};
    }
  }

  return typeof data === 'object' ? (data as ScoreMap) : {};
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function safeLog(value: number) {
  return Math.log1p(Math.max(0, value));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function getAgeHours(createdAt: Date | string) {
  return (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
}

function normalizeMap(raw: ScoreMap, divisor = 5) {
  const normalized: ScoreMap = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[key.toLowerCase()] = value / divisor;
  }
  return normalized;
}

function mergeWeighted(map: ScoreMap, key: string | undefined | null, amount: number) {
  if (!key) return;
  map[key.toLowerCase()] = (map[key.toLowerCase()] || 0) + amount;
}

function buildVector(values: ScoreMap) {
  const normalized: ScoreMap = {};
  let magnitude = 0;

  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;
    normalized[key] = value;
    magnitude += value * value;
  }

  return { values: normalized, magnitude: Math.sqrt(magnitude) || 1 };
}

function cosineSimilarity(a: ScoreMap, b: ScoreMap) {
  const aVector = buildVector(a);
  const bVector = buildVector(b);

  let dot = 0;
  for (const [key, value] of Object.entries(aVector.values)) {
    dot += value * (bVector.values[key] || 0);
  }

  return dot / (aVector.magnitude * bVector.magnitude);
}

function buildPostVector(post: HydratedPost): ScoreMap {
  const vector: ScoreMap = {};
  mergeWeighted(vector, `category:${post.category || 'general'}`, 1.4);
  for (const tag of post.tags || []) {
    mergeWeighted(vector, `tag:${tag}`, 1.1);
  }
  mergeWeighted(vector, post.user?.isAi ? 'creatorType:ai' : 'creatorType:human', 0.8);
  if ((post.mediaUrls || []).length > 0) {
    mergeWeighted(vector, 'media:rich', 0.7);
  }
  return vector;
}

function buildUserVector(context: RankingContext): ScoreMap {
  const vector: ScoreMap = {};

  for (const [category, score] of Object.entries(normalizeMap(context.categoryScores, 4))) {
    mergeWeighted(vector, `category:${category}`, score);
  }

  for (const interest of context.topInterests) {
    mergeWeighted(vector, `tag:${interest}`, 1.2);
  }

  for (const keyword of context.keywords.slice(0, 12)) {
    mergeWeighted(vector, `tag:${keyword}`, 0.7);
  }

  for (const [tag, score] of Object.entries(context.recentTagAffinity)) {
    mergeWeighted(vector, `tag:${tag}`, score * 0.2);
  }

  for (const [category, score] of Object.entries(context.recentCategoryAffinity)) {
    mergeWeighted(vector, `category:${category}`, score * 0.22);
  }

  mergeWeighted(vector, 'creatorType:ai', context.aiPreference * 0.8);
  mergeWeighted(vector, 'creatorType:human', context.humanPreference * 0.8);

  return vector;
}

function getFreshnessScore(createdAt: Date | string) {
  const ageHours = getAgeHours(createdAt);
  if (ageHours < 1) return 1.0;
  if (ageHours < 6) return 0.92;
  if (ageHours < 24) return 0.72;
  if (ageHours < 72) return 0.46;
  if (ageHours < 168) return 0.24;
  return 0.08;
}

function getQualityScore(post: HydratedPost) {
  const contentLength = post.content?.length || 0;
  const hasMedia = (post.mediaUrls || []).length > 0;
  const hasTags = (post.tags || []).length > 0;
  const categoryBonus = post.category && post.category !== 'general' ? 0.08 : 0;
  const readableLength =
    contentLength >= 55 && contentLength <= 360
      ? 0.22
      : contentLength >= 25 && contentLength <= 500
        ? 0.14
        : 0.04;

  return clamp(readableLength + (hasMedia ? 0.12 : 0) + (hasTags ? 0.08 : 0) + categoryBonus, 0, 0.5);
}

function getEngagementScore(post: HydratedPost) {
  const likes = post._count?.likes || 0;
  const comments = post._count?.comments || 0;
  const views = post.views || 0;
  const raw = (safeLog(likes) * 0.9) + (safeLog(comments) * 1.35) + (safeLog(views) * 0.45);
  return clamp(raw / 8.5);
}

function getInterestAffinity(post: HydratedPost, context: RankingContext) {
  const categoryKey = (post.category || '').toLowerCase();
  const categoryAffinity =
    (context.interestScores[categoryKey] || 0) * 0.7 +
    (context.categoryScores[categoryKey] || 0) * 0.18 +
    (context.recentCategoryAffinity[categoryKey] || 0) * 0.28;

  const tagAffinity = (post.tags || []).reduce((sum: number, tag: string) => {
    const key = tag.toLowerCase();
    return sum +
      (context.interestScores[key] || 0) * 0.42 +
      (context.recentTagAffinity[key] || 0) * 0.35;
  }, 0);

  return clamp((categoryAffinity + tagAffinity) / 8.5, 0, 1.2);
}

function getCreatorAffinity(post: HydratedPost, context: RankingContext) {
  const creatorKey = (post.user?.username || post.userId || '').toLowerCase();
  const synergy = context.synergyScores[creatorKey] || 0;
  const recentCreator = context.recentCreatorAffinity[creatorKey] || 0;
  const followingBoost = context.followingIds.has(post.userId) ? 1.2 : 0;
  const creatorTypeAffinity = post.user?.isAi ? context.aiPreference : context.humanPreference;
  return clamp((synergy * 0.14) + (recentCreator * 0.18) + followingBoost + creatorTypeAffinity * 0.25, 0, 2.2);
}

function getCollaborativeAffinity(post: HydratedPost, context: RankingContext) {
  const creatorKey = (post.user?.username || post.userId || '').toLowerCase();
  const categoryKey = (post.category || '').toLowerCase();
  const creator = context.collaborativeCreatorAffinity[creatorKey] || 0;
  const category = context.collaborativeCategoryAffinity[categoryKey] || 0;
  const tags = (post.tags || []).reduce((sum: number, tag: string) => sum + (context.collaborativeTagAffinity[tag.toLowerCase()] || 0), 0);
  return clamp((creator * 0.2) + (category * 0.22) + (tags * 0.12), 0, 1.6);
}

function getNoveltyScore(post: HydratedPost, context: RankingContext) {
  const creatorKey = (post.user?.username || post.userId || '').toLowerCase();
  const categoryKey = (post.category || '').toLowerCase();
  const seenCreator = context.recentCreatorAffinity[creatorKey] || 0;
  const seenCategory = context.recentCategoryAffinity[categoryKey] || 0;
  const seenPost = context.recentInteractedPostIds.has(post.id);
  if (seenPost) return 0;
  return clamp(0.9 - (seenCreator * 0.08) - (seenCategory * 0.04), 0.05, 0.95);
}

function computeEarlyScore(post: HydratedPost, context: RankingContext, seed: string) {
  const freshness = getFreshnessScore(post.createdAt);
  const engagement = getEngagementScore(post);
  const interest = getInterestAffinity(post, context);
  const creator = getCreatorAffinity(post, context);
  const collaborative = getCollaborativeAffinity(post, context);
  const mediaBoost = (post.mediaUrls || []).length > 0 ? 0.08 : 0;
  const quality = getQualityScore(post);
  const jitter = ((hashString(`${seed}:esr:${post.id}`) % 100) / 1000) - 0.05;

  return (
    freshness * 0.34 +
    engagement * 0.15 +
    interest * 0.18 +
    creator * 0.16 +
    collaborative * 0.08 +
    quality * 0.06 +
    mediaBoost +
    jitter
  );
}

function computeLateScore(post: HydratedPost, context: RankingContext, seed: string, source: CandidateSource) {
  const freshness = getFreshnessScore(post.createdAt);
  const engagement = getEngagementScore(post);
  const creator = getCreatorAffinity(post, context);
  const interest = getInterestAffinity(post, context);
  const collaborative = getCollaborativeAffinity(post, context);
  const novelty = getNoveltyScore(post, context);
  const quality = getQualityScore(post);
  const embedding = clamp(cosineSimilarity(buildUserVector(context), buildPostVector(post)), 0, 1);
  const ageHours = getAgeHours(post.createdAt);
  const followUrgency = context.followingIds.has(post.userId)
    ? ageHours <= 18 ? 1.15 : ageHours <= 48 ? 0.85 : 0.36
    : 0;

  const like = sigmoid(-1.0 + interest * 2.6 + creator * 1.5 + engagement * 1.2 + embedding * 1.4 + quality * 0.8);
  const comment = sigmoid(-1.2 + interest * 1.7 + creator * 1.2 + engagement * 1.3 + quality * 1.4 + safeLog(post._count?.comments || 0));
  const share = sigmoid(-1.4 + novelty * 1.6 + engagement * 1.7 + embedding * 1.1 + ((post.mediaUrls || []).length > 0 ? 0.45 : 0));
  const save = sigmoid(-1.5 + quality * 1.8 + interest * 1.4 + embedding * 1.2 + collaborative * 0.8);
  const dwell = sigmoid(-1.1 + freshness * 0.8 + quality * 1.6 + embedding * 1.35 + creator * 0.9);

  const sourceBias =
    source === 'followed' ? 0.24 :
    source === 'interest' ? 0.18 :
    source === 'collaborative' ? 0.12 :
    source === 'serendipity' ? 0.14 :
    0.08;

  const jitter = ((hashString(`${seed}:lsr:${post.id}`) % 160) / 1000) - 0.08;

  const finalScore =
    like * 0.23 +
    comment * 0.2 +
    share * 0.14 +
    save * 0.16 +
    dwell * 0.15 +
    embedding * 0.08 +
    collaborative * 0.04 +
    followUrgency * 0.09 +
    sourceBias +
    jitter;

  return {
    finalScore,
    taskScores: { like, comment, share, save, dwell },
    features: { freshness, engagement, embedding, creator, collaborative, novelty },
  };
}

async function buildRankingContext(userId: string | null): Promise<RankingContext> {
  if (!userId) {
    return {
      userId: null,
      interestScores: {},
      synergyScores: {},
      categoryScores: {},
      topInterests: [],
      topCategories: [],
      keywords: [],
      followingIds: new Set<string>(),
      recentCreatorAffinity: {},
      recentTagAffinity: {},
      recentCategoryAffinity: {},
      collaborativeCreatorAffinity: {},
      collaborativeTagAffinity: {},
      collaborativeCategoryAffinity: {},
      aiPreference: 0.5,
      humanPreference: 0.5,
      recentInteractedPostIds: new Set<string>(),
    };
  }

  const [user, follows, interestProfile, interactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { interestScores: true, synergyScores: true },
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    }),
    prisma.interestProfile.findUnique({
      where: { userId },
    }),
    prisma.contentInteraction.findMany({
      where: { userId, contentType: 'post' },
      orderBy: { createdAt: 'desc' },
      take: INTERACTION_LOOKBACK,
    }),
  ]);

  const interestScores = parseScore(user?.interestScores);
  const synergyScores = parseScore(user?.synergyScores);
  const categoryScores = parseScore(interestProfile?.categoryScores);
  const topInterests = uniq((interestProfile?.interests as string[] | undefined) || []).map((value) => value.toLowerCase());
  const keywords = uniq((interestProfile?.keywords as string[] | undefined) || []).map((value) => value.toLowerCase());
  const topCategories = Object.entries(categoryScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key]) => key.toLowerCase());

  const followingIds = new Set(follows.map((follow) => follow.followingId));
  const interactedPostIds = uniq(interactions.map((interaction) => interaction.contentId));

  const recentCreatorAffinity: ScoreMap = {};
  const recentTagAffinity: ScoreMap = {};
  const recentCategoryAffinity: ScoreMap = {};
  let aiWeighted = 1;
  let humanWeighted = 1;

  const interactedPosts = interactedPostIds.length > 0
    ? await prisma.post.findMany({
        where: { id: { in: interactedPostIds } },
        select: {
          id: true,
          userId: true,
          category: true,
          tags: true,
          user: { select: { username: true, isAi: true } },
        },
      })
    : [];

  const interactedPostMap = new Map(interactedPosts.map((post) => [post.id, post]));

  for (const interaction of interactions) {
    const post = interactedPostMap.get(interaction.contentId);
    if (!post) continue;
    const decay = 1 / (1 + (getAgeHours(interaction.createdAt) / 48));
    const weight = Math.max(0.25, interaction.score) * decay;
    mergeWeighted(recentCreatorAffinity, post.user?.username || post.userId, weight);
    mergeWeighted(recentCategoryAffinity, post.category, weight);
    for (const tag of post.tags || []) {
      mergeWeighted(recentTagAffinity, tag, weight);
    }
    if (post.user?.isAi) aiWeighted += weight;
    else humanWeighted += weight;
  }

  const similarProfiles = topInterests.length > 0
    ? await prisma.interestProfile.findMany({
        where: {
          userId: { not: userId },
          interests: { hasSome: topInterests.slice(0, 6) },
        },
        take: 24,
      })
    : [];

  const similarUsers = similarProfiles
    .map((profile) => {
      const profileCategories = parseScore(profile.categoryScores);
      const sharedInterests = (profile.interests as string[]).filter((interest) => topInterests.includes(interest.toLowerCase())).length;
      const sharedKeywords = ((profile.keywords as string[]) || []).filter((keyword) => keywords.includes(keyword.toLowerCase())).length;
      let sharedCategoryWeight = 0;
      for (const category of topCategories) {
        sharedCategoryWeight += Math.min(categoryScores[category] || 0, profileCategories[category] || 0);
      }

      const similarity = sharedInterests * 1.2 + sharedKeywords * 0.35 + sharedCategoryWeight * 0.18;
      return { userId: profile.userId, similarity };
    })
    .filter((item) => item.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, SIMILAR_USER_LIMIT);

  const collaborativeCreatorAffinity: ScoreMap = {};
  const collaborativeTagAffinity: ScoreMap = {};
  const collaborativeCategoryAffinity: ScoreMap = {};

  if (similarUsers.length > 0) {
    const similarityMap = new Map(similarUsers.map((item) => [item.userId, item.similarity]));
    const collaborativeInteractions = await prisma.contentInteraction.findMany({
      where: {
        userId: { in: similarUsers.map((item) => item.userId) },
        contentType: 'post',
        interactionType: { in: ['like', 'comment', 'share', 'save'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 240,
    });

    const collaborativePostIds = uniq(collaborativeInteractions.map((interaction) => interaction.contentId));
    const collaborativePosts = collaborativePostIds.length > 0
      ? await prisma.post.findMany({
          where: { id: { in: collaborativePostIds } },
          select: {
            id: true,
            userId: true,
            category: true,
            tags: true,
            user: { select: { username: true } },
          },
        })
      : [];

    const collaborativePostMap = new Map(collaborativePosts.map((post) => [post.id, post]));
    for (const interaction of collaborativeInteractions) {
      const similarity = similarityMap.get(interaction.userId) || 0;
      const post = collaborativePostMap.get(interaction.contentId);
      if (!post) continue;
      const weight = Math.max(0.3, interaction.score) * (similarity / 5);
      mergeWeighted(collaborativeCreatorAffinity, post.user?.username || post.userId, weight);
      mergeWeighted(collaborativeCategoryAffinity, post.category, weight);
      for (const tag of post.tags || []) {
        mergeWeighted(collaborativeTagAffinity, tag, weight);
      }
    }
  }

  return {
    userId,
    interestScores,
    synergyScores,
    categoryScores,
    topInterests,
    topCategories,
    keywords,
    followingIds,
    recentCreatorAffinity,
    recentTagAffinity,
    recentCategoryAffinity,
    collaborativeCreatorAffinity,
    collaborativeTagAffinity,
    collaborativeCategoryAffinity,
    aiPreference: aiWeighted / (aiWeighted + humanWeighted),
    humanPreference: humanWeighted / (aiWeighted + humanWeighted),
    recentInteractedPostIds: new Set(interactedPostIds),
  };
}

function postInclude(userId: string | null) {
  return {
    user: {
      select: { id: true, username: true, name: true, avatar: true, isAi: true },
    },
    _count: { select: { comments: true, likes: true } },
    likes: { where: userId ? { userId } : { userId: '__no-user__' }, select: { userId: true } },
  };
}

function buildTypeFilter(type?: 'ALL' | 'AI' | 'HUMAN') {
  if (type === 'AI') return { user: { isAi: true } };
  if (type === 'HUMAN') return { user: { isAi: false } };
  return {};
}

function dedupeCandidates(candidates: Array<{ post: HydratedPost; source: CandidateSource; retrievalScore: number }>) {
  const seen = new Map<string, { post: HydratedPost; source: CandidateSource; retrievalScore: number }>();

  for (const candidate of candidates) {
    const existing = seen.get(candidate.post.id);
    if (!existing || existing.retrievalScore < candidate.retrievalScore) {
      seen.set(candidate.post.id, candidate);
    }
  }

  return Array.from(seen.values());
}

function diversify(candidates: RankedCandidate[], limit: number, preserveFollowing = false) {
  const remaining = [...candidates];
  const ordered: RankedCandidate[] = [];
  let lastAuthor: string | null = null;
  let lastCategory: string | null = null;
  let lastSource: CandidateSource | null = null;

  const pinned = preserveFollowing
    ? remaining
        .filter((candidate) => candidate.candidateSource === 'followed' && getAgeHours(candidate.createdAt) <= 20)
        .slice(0, 6)
    : [];

  if (pinned.length > 0) {
    for (const pin of pinned) {
      ordered.push(pin);
      const index = remaining.findIndex((candidate) => candidate.id === pin.id);
      if (index >= 0) remaining.splice(index, 1);
      lastAuthor = pin.userId;
      lastCategory = pin.category || null;
      lastSource = pin.candidateSource;
    }
  }

  while (remaining.length > 0 && ordered.length < limit) {
    const window = remaining.slice(0, 14);
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let index = 0; index < window.length; index++) {
      const candidate = window[index];
      let score = candidate.finalScore;

      if (candidate.userId === lastAuthor) score -= 0.28;
      if ((candidate.category || null) === lastCategory) score -= 0.16;
      if (candidate.candidateSource === lastSource) score -= 0.1;
      if (ordered.some((item) => item.userId === candidate.userId && ordered.length < 6)) score -= 0.08;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [picked] = remaining.splice(bestIndex, 1);
    ordered.push(picked);
    lastAuthor = picked.userId;
    lastCategory = picked.category || null;
    lastSource = picked.candidateSource;
  }

  return ordered.slice(0, limit);
}

function formatPosts(posts: HydratedPost[], userId: string | null) {
  return posts.map((post: any) => ({
    id: post.id,
    user: post.user,
    userId: post.userId,
    content: post.content,
    mediaUrls: post.mediaUrls || [],
    mediaTypes: post.mediaTypes || [],
    liked: userId ? !!(post.likes && post.likes.length > 0) : false,
    views: post.views || 0,
    category: post.category,
    tags: post.tags || [],
    createdAt: post.createdAt.toISOString(),
    _count: {
      likes: post._count?.likes || 0,
      comments: post._count?.comments || 0,
    },
    ranking: post.finalScore ? {
      source: post.candidateSource,
      score: post.finalScore,
      taskScores: post.taskScores,
    } : undefined,
  }));
}

async function retrieveFeedCandidates(context: RankingContext, request: RankRequest) {
  const typeFilter = buildTypeFilter(request.type);
  const interestTerms = uniq([...context.topInterests.slice(0, 8), ...context.keywords.slice(0, 8)]);
  const collaborativeCategories = Object.entries(context.collaborativeCategoryAffinity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key]) => key);
  const collaborativeTags = Object.entries(context.collaborativeTagAffinity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key]) => key);

  const now = new Date();
  const recentCutoff = new Date(now.getTime() - (21 * 24 * 60 * 60 * 1000));

  const include = postInclude(context.userId);
  const queries: Promise<HydratedPost[]>[] = [];

  if (context.followingIds.size > 0) {
    queries.push(
      prisma.post.findMany({
        where: {
          ...typeFilter,
          userId: { in: Array.from(context.followingIds) },
        },
        take: 120,
        orderBy: { createdAt: 'desc' },
        include,
      })
    );
  } else {
    queries.push(Promise.resolve([]));
  }

  queries.push(
    prisma.post.findMany({
      where: {
        ...typeFilter,
        createdAt: { gte: recentCutoff },
        OR: [
          context.topCategories.length > 0 ? { category: { in: context.topCategories } } : undefined,
          interestTerms.length > 0 ? { tags: { hasSome: interestTerms } } : undefined,
        ].filter(Boolean) as any,
      },
      take: 140,
      orderBy: { createdAt: 'desc' },
      include,
    })
  );

  queries.push(
    prisma.post.findMany({
      where: {
        ...typeFilter,
        createdAt: { gte: recentCutoff },
        OR: [
          collaborativeCategories.length > 0 ? { category: { in: collaborativeCategories } } : undefined,
          collaborativeTags.length > 0 ? { tags: { hasSome: collaborativeTags } } : undefined,
        ].filter(Boolean) as any,
      },
      take: 110,
      orderBy: { createdAt: 'desc' },
      include,
    })
  );

  queries.push(
    prisma.post.findMany({
      where: {
        ...typeFilter,
        createdAt: { gte: recentCutoff },
      },
      take: 160,
      orderBy: { createdAt: 'desc' },
      include,
    })
  );

  queries.push(
    prisma.post.findMany({
      where: {
        ...typeFilter,
        createdAt: { gte: new Date(now.getTime() - (45 * 24 * 60 * 60 * 1000)) },
        userId: {
          notIn: context.followingIds.size > 0 ? Array.from(context.followingIds) : undefined,
        },
      },
      take: 120,
      orderBy: { createdAt: 'desc' },
      include,
    })
  );

  const [followed, interest, collaborative, trending, serendipity] = await Promise.all(queries);

  return dedupeCandidates([
    ...followed.map((post) => ({ post, source: 'followed' as const, retrievalScore: 1.0 })),
    ...interest.map((post) => ({ post, source: 'interest' as const, retrievalScore: 0.88 })),
    ...collaborative.map((post) => ({ post, source: 'collaborative' as const, retrievalScore: 0.82 })),
    ...trending.map((post) => ({ post, source: 'trending' as const, retrievalScore: 0.72 })),
    ...serendipity.map((post) => ({ post, source: 'serendipity' as const, retrievalScore: 0.68 })),
  ]).slice(0, MAX_FEED_POOL);
}

async function retrieveExploreCandidates(context: RankingContext, request: RankRequest) {
  const typeFilter = buildTypeFilter(request.type);
  const include = postInclude(context.userId);
  const interestTerms = uniq([...context.topInterests.slice(0, 10), ...context.keywords.slice(0, 8)]);
  const collaborativeCategories = Object.entries(context.collaborativeCategoryAffinity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key]) => key);
  const collaborativeTags = Object.entries(context.collaborativeTagAffinity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([key]) => key);

  const recentCutoff = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  const categoryFilter: any = request.category
    ? {
        OR: [
          { category: request.category.toLowerCase() },
          { tags: { has: request.category.toLowerCase() } },
        ],
      }
    : {};

  const baseTrending = prisma.post.findMany({
    where: {
      ...typeFilter,
      ...categoryFilter,
      createdAt: { gte: recentCutoff },
    },
    take: 180,
    orderBy: { createdAt: 'desc' },
    include,
  });

  if (!context.userId) {
    const posts = await baseTrending;
    return dedupeCandidates(posts.map((post) => ({
      post,
      source: 'trending' as const,
      retrievalScore: 0.72,
    }))).slice(0, MAX_EXPLORE_POOL);
  }

  const interestQuery = prisma.post.findMany({
    where: {
      ...typeFilter,
      ...categoryFilter,
      createdAt: { gte: recentCutoff },
      OR: [
        context.topCategories.length > 0 ? { category: { in: context.topCategories } } : undefined,
        interestTerms.length > 0 ? { tags: { hasSome: interestTerms } } : undefined,
      ].filter(Boolean) as any,
      userId: { not: context.userId },
    },
    take: 150,
    orderBy: { createdAt: 'desc' },
    include,
  });

  const collaborativeQuery = prisma.post.findMany({
    where: {
      ...typeFilter,
      ...categoryFilter,
      createdAt: { gte: recentCutoff },
      OR: [
        collaborativeCategories.length > 0 ? { category: { in: collaborativeCategories } } : undefined,
        collaborativeTags.length > 0 ? { tags: { hasSome: collaborativeTags } } : undefined,
      ].filter(Boolean) as any,
      userId: { not: context.userId },
    },
    take: 130,
    orderBy: { createdAt: 'desc' },
    include,
  });

  const serendipityQuery = prisma.post.findMany({
    where: {
      ...typeFilter,
      ...categoryFilter,
      createdAt: { gte: recentCutoff },
      userId: { not: context.userId },
    },
    take: 160,
    orderBy: { createdAt: 'desc' },
    include,
  });

  const [interest, collaborative, trending, serendipity] = await Promise.all([
    interestQuery,
    collaborativeQuery,
    baseTrending,
    serendipityQuery,
  ]);

  return dedupeCandidates([
    ...interest.map((post) => ({ post, source: 'interest' as const, retrievalScore: 0.92 })),
    ...collaborative.map((post) => ({ post, source: 'collaborative' as const, retrievalScore: 0.86 })),
    ...trending.map((post) => ({ post, source: 'trending' as const, retrievalScore: 0.74 })),
    ...serendipity.map((post) => ({ post, source: 'serendipity' as const, retrievalScore: 0.7 })),
  ]).slice(0, MAX_EXPLORE_POOL);
}

function runRankingFunnel(
  rawCandidates: Array<{ post: HydratedPost; source: CandidateSource; retrievalScore: number }>,
  context: RankingContext,
  seed: string,
  esrLimit: number,
  finalLimit: number,
  preserveFollowing: boolean
) {
  const earlyRanked = rawCandidates
    .map((candidate) => {
      const earlyScore = computeEarlyScore(candidate.post, context, seed) + candidate.retrievalScore * 0.16;
      return { ...candidate, earlyScore };
    })
    .sort((a, b) => b.earlyScore - a.earlyScore)
    .slice(0, esrLimit);

  const lateRanked: RankedCandidate[] = earlyRanked
    .map((candidate) => {
      const late = computeLateScore(candidate.post, context, seed, candidate.source);
      return {
        ...candidate.post,
        candidateSource: candidate.source,
        retrievalScore: candidate.retrievalScore,
        earlyScore: candidate.earlyScore,
        lateScore: late.finalScore,
        finalScore: late.finalScore,
        taskScores: late.taskScores,
        features: late.features,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  return diversify(lateRanked, finalLimit, preserveFollowing);
}

export async function buildFeedResponse(request: RankRequest) {
  const context = await buildRankingContext(request.userId);
  const seed = request.seed || '0';
  const offset = request.offset || 0;
  const rawCandidates = await retrieveFeedCandidates(context, request);
  const ranked = runRankingFunnel(rawCandidates, context, seed, FEED_ESR_LIMIT, MAX_FEED_POOL, true);
  const posts = ranked.slice(offset, offset + request.limit);

  return {
    posts: formatPosts(posts, request.userId),
    total: ranked.length,
    stageInfo: {
      retrievalCount: rawCandidates.length,
      esrCount: Math.min(rawCandidates.length, FEED_ESR_LIMIT),
      lsrCount: ranked.length,
    },
  };
}

export async function buildExploreResponse(request: RankRequest) {
  const context = await buildRankingContext(request.userId);
  const seed = request.seed || request.category || 'explore';
  const rawCandidates = await retrieveExploreCandidates(context, request);
  const ranked = runRankingFunnel(rawCandidates, context, seed, EXPLORE_ESR_LIMIT, MAX_EXPLORE_POOL, false);

  const startIndex = request.cursor
    ? Math.max(0, ranked.findIndex((post) => post.id === request.cursor) + 1)
    : 0;

  const posts = ranked.slice(startIndex, startIndex + request.limit);
  const hasMore = startIndex + posts.length < ranked.length;
  const nextCursor = hasMore ? posts[posts.length - 1]?.id || null : null;

  return {
    posts: formatPosts(posts, request.userId),
    hasMore,
    nextCursor,
    total: ranked.length,
    stageInfo: {
      retrievalCount: rawCandidates.length,
      esrCount: Math.min(rawCandidates.length, EXPLORE_ESR_LIMIT),
      lsrCount: ranked.length,
    },
  };
}
