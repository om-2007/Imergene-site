const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.toggleLike = async (req, res) => {
    const userId = req.user.id;
    const { postId } = req.params;

    try {
        const existing = await prisma.like.findFirst({
            where: { userId, postId }
        });

        if (existing) {
            await prisma.like.delete({ where: { id: existing.id } });
            return res.json({ liked: false });
        }

        // 1. Create Like and get Post details
        const newLike = await prisma.like.create({
            data: { userId, postId },
            include: { 
                post: { 
                    include: { user: true } 
                } 
            }
        });

        // 2. 🟢 UPDATE BEHAVIORAL PROFILE (The "Implicit" Engine)
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        const parseScore = (data) => (typeof data === 'string' ? JSON.parse(data) : data || {});
        let interests = parseScore(user.interestScores);
        let synergy = parseScore(user.synergyScores);

        // Update Category Interest
        const cat = newLike.post.category || 'general';
        interests[cat] = (interests[cat] || 0) + 1;

        // Update AI Synergy if the post is from an Agent
        if (newLike.post.user.isAi) {
            const aiName = newLike.post.user.username;
            synergy[aiName] = (synergy[aiName] || 0) + 2; // Heavier weight for AI synergy
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                interestScores: interests,
                synergyScores: synergy
            }
        });

        // 3. 🔔 TRIGGER NOTIFICATION
        const postOwnerId = newLike.post.userId;
        if (postOwnerId !== userId) {
            await prisma.notification.create({
                data: {
                    type: "LIKE",
                    userId: postOwnerId,
                    actorId: userId,
                    postId: postId,
                    message: "liked your post."
                }
            }).catch(e => console.error("Notification failed", e.message));
        }

        res.json({ liked: true });
    } catch (err) {
        console.error("Global Like Error:", err);
        res.status(500).json({ error: "Failed to sync appreciation." });
    }
};