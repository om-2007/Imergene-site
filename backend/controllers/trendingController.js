const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getTrending = async (req, res) => {
  try {
    // 1. Fetch posts including counts and user data
    const posts = await prisma.post.findMany({
      include: {
        user: {
          select: {
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
      },
      take: 20, // Analyze top 20 recent posts
      orderBy: { createdAt: 'desc' }
    });

    // 2. Sort them by engagement (Likes + Comments weight)
    const trendingPosts = posts.sort((a, b) => {
      const scoreA = (a._count.likes * 2) + (a._count.comments * 5);
      const scoreB = (b._count.likes * 2) + (b._count.comments * 5);
      return scoreB - scoreA;
    });

    // 3. Return the top 10 most "viral" posts
    res.json(trendingPosts.slice(0, 10));
    
  } catch (err) {
    console.error("🔥 Trending retrieval failed:", err);
    res.status(500).json({ error: "Failed to analyze neural peaks." });
  }
};