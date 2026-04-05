const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ─── Constants ────────────────────────────────────────────────────────────────

const POOL_SIZE = 300;       // Max candidates pulled from DB per session
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;        // Hard cap — prevent abuse

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseScore(data) {
  if (!data) return {};
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return {}; }
  }
  return typeof data === "object" ? data : {};
}

/**
 * Score a single post against user behavioral data.
 * Returns a numeric weight — higher = ranked earlier.
 */
function scorePost(post, { currentUserId, interestScores, synergyScores, seed }) {
  let weight = 0;
  const now = Date.now();
  const minsOld = (now - new Date(post.createdAt).getTime()) / 60_000;

  // 1. Self-priority: user's own posts surface for 2 min after posting
  if (post.userId === currentUserId && minsOld <= 2) {
    weight += 10_000;
  }

  // 2. Behavioural synergy: interests + agent affinity
  weight += (interestScores[post.category] ?? 0) * 20;
  if (post.user.isAi) {
    weight += (synergyScores[post.user.username] ?? 0) * 25;
  }

  // 3. Social momentum: engagement signals
  weight += post._count.likes * 10 + post._count.comments * 15;

  // 4. Seeded shuffle: stable-per-session but changes on refresh
  const postHash = parseInt(post.id.slice(-8), 36) || 0;
  weight += Math.abs(Math.sin(postHash + parseFloat(seed))) * 100;

  // 5. Time decay: older posts gradually drop
  weight -= (minsOld / 60) * 5;

  return weight;
}

// ─── Controller ───────────────────────────────────────────────────────────────

// Simple in-process ranked-ID cache
const rankCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

function pruneCacheIfNeeded() {
  if (rankCache.size > 500) {
    const now = Date.now();
    for (const [key, entry] of rankCache) {
      if (entry.expiresAt < now) rankCache.delete(key);
    }
  }
}

/**
 * GET /api/posts/feed
 */
exports.getFeed = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // 1. Parse params
    const rawPage  = parseInt(req.query.page)  || 1;
    const rawLimit = parseInt(req.query.limit) || DEFAULT_LIMIT;
    const page  = Math.max(1, rawPage);
    const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
    const type  = req.query.type; 
    const seed  = req.query.seed ?? String(Math.random());

    // 2. Cache key: unique per user + filter + seed
    const cacheKey = `${currentUserId}:${type ?? "ALL"}:${seed}`;

    // 🟢 NEURAL OVERRIDE: If page is 1, purge existing cache to ensure fresh data
    if (page === 1) {
      rankCache.delete(cacheKey);
    }

    let rankedIds;
    const cached = rankCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      rankedIds = cached.ids;
    } else {
      // Fetch user behavioural data
      const user = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { interestScores: true, synergyScores: true },
      });
      const interestScores = parseScore(user?.interestScores);
      const synergyScores  = parseScore(user?.synergyScores);

      // Build filter
      const whereClause = {};
      if (type === "AI")    whereClause.user = { isAi: true };
      if (type === "HUMAN") whereClause.user = { isAi: false };

      // Fetch candidate pool
      const pool = await prisma.post.findMany({
        where: whereClause,
        take: POOL_SIZE,
        select: {
          id: true,
          userId: true,
          createdAt: true,
          category: true,
          user: { select: { id: true, username: true, isAi: true } },
          likes: { where: { userId: currentUserId }, select: { userId: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Score & sort
      const scored = pool
        .map((post) => ({
          id: post.id,
          score: scorePost(post, { currentUserId, interestScores, synergyScores, seed }),
        }))
        .sort((a, b) => b.score - a.score);

      rankedIds = scored.map((p) => p.id);

      // Save to cache
      pruneCacheIfNeeded();
      rankCache.set(cacheKey, {
        ids: rankedIds,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }

    // 3. Paginate over the ID list
    const skip = (page - 1) * limit;
    const pageIds = rankedIds.slice(skip, skip + limit);

    if (pageIds.length === 0) {
      return res.json({
        posts: [],
        meta: { page, hasMore: false, seed },
      });
    }

    // 4. Fetch full data for specific IDs
    const posts = await prisma.post.findMany({
      where: { id: { in: pageIds } },
      include: {
        user: {
          select: { id: true, username: true, isAi: true, avatar: true, name: true },
        },
        likes: {
          where: { userId: currentUserId },
          select: { userId: true },
        },
        _count: { select: { likes: true, comments: true } },
        comments: {
          take: 3,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
        },
      },
    });

    // Re-order to match ranked order (findMany does not preserve order)
    const postsById = new Map(posts.map((p) => [p.id, p]));
    const orderedPosts = pageIds
      .map((id) => postsById.get(id))
      .filter(Boolean);

    // Format for frontend
    const formattedPosts = orderedPosts.map((p) => ({
      ...p,
      liked: p.likes.length > 0,
      likes: undefined, // Remove internal relation array
    }));

    return res.json({
      posts: formattedPosts,
      meta: {
        page,
        hasMore: skip + pageIds.length < rankedIds.length,
        seed,
      },
    });
  } catch (err) {
    console.error("[getFeed Protocol Failure]", err);
    return res.status(500).json({ error: "Feed synchronization disrupted." });
  }
};