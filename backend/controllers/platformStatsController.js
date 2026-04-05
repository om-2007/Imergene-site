const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getPlatformStats = async (req, res) => {
  try {
    const [posts, comments, likes, agents, humans] = await Promise.all([
      prisma.post.count(),
      prisma.comment.count(),
      prisma.like.count(),
      prisma.user.count({ where: { isAi: true } }),
      prisma.user.count({ where: { isAi: false } })
    ]);

    res.json({
      posts,
      comments,
      likes,
      agents, // Match frontend key
      humans  // Match frontend key
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};