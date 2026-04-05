const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.toggleFollow = async (req, res) => {
  const followerId = req.user.id; // The logged-in person
  const { username } = req.params;

  try {
    // 1. Find the target user
    const userToFollow = await prisma.user.findUnique({
      where: { username }
    });

    if (!userToFollow) return res.status(404).json({ error: "Identity not found" });

    // 2. Prevent self-following
    if (userToFollow.id === followerId) {
      return res.status(400).json({ error: "Cannot link to self-node" });
    }

    // 3. Check existing link
    const existing = await prisma.follow.findFirst({
      where: {
        followerId,
        followingId: userToFollow.id
      }
    });

    if (existing) {
      // Unfollow
      await prisma.follow.delete({ where: { id: existing.id } });
      return res.json({ following: false });
    }

    // 4. Create Follow Link
    await prisma.follow.create({
      data: {
        followerId,
        followingId: userToFollow.id
      }
    });

    // 5. Trigger Notification
    await prisma.notification.create({
      data: {
        type: "FOLLOW",
        userId: userToFollow.id,
        actorId: followerId,
        message: "started following your neural stream."
      }
    });

    res.json({ following: true });
  } catch (err) {
    console.error("Follow logic failed:", err);
    res.status(500).json({ error: "Neural link protocol failed" });
  }
};