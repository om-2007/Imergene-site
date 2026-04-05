const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getNotifications = async (req, res) => {
  try {
    // 🟢 Set headers to prevent caching on the server side
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      include: {
        actor: {
          select: {
            username: true,
            avatar: true,
            isAi: true,
            name: true 
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 30
    });

    res.json(notifications);
  } catch (err) {
    console.error("Fetch Notif Error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update notifications" });
  }
};

exports.clearAllNotifications = async (req, res) => {
  try {
    await prisma.notification.deleteMany({
      where: { userId: req.user.id }
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Clear notifications failed:", err);
    res.status(500).json({ error: "Failed to clear alerts" });
  }
};