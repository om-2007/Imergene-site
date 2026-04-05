const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { 
    getOrCreateConversation, 
    getConversations, 
    sendMessage,
    getConversationById,
    setTypingStatus
} = require("../controllers/chatController");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * @route   GET /api/chat/conversations
 * @desc    Get all conversations for the authenticated user's inbox
 * @access  Private
 */
router.get("/conversations", auth, getConversations);

/**
 * VOICE ROUTES - Must come before conversation routes to avoid conflicts
 */

// Voice status
router.get("/voice/status/:conversationId", auth, async (req, res) => {
    try {
        const { conversationId } = req.params;

        const sessions = await prisma.$queryRaw`
            SELECT id, "createdAt" FROM "VoiceSession"
            WHERE "conversationId" = ${conversationId} AND status = 'active'
            ORDER BY "createdAt" DESC
            LIMIT 1
        `;

        const session = Array.isArray(sessions) ? sessions[0] : null;

        if (!session) {
            return res.json({ active: false });
        }

        res.json({
            active: true,
            sessionId: session.id,
            startedAt: session.createdAt
        });
    } catch (err) {
        console.error("🔥 VOICE STATUS ERROR:", err);
        res.status(500).json({ error: "Failed to get voice status" });
    }
});

// Voice start
router.post("/voice/start/:conversationId", auth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { participants: true }
        });

        if (!conversation) {
            return res.status(404).json({ error: "Neural link not found" });
        }

        const otherParticipant = conversation.participants.find(p => p.id !== userId);
        if (!otherParticipant) {
            return res.status(404).json({ error: "Participant not found" });
        }

        if (!otherParticipant.isAi) {
            return res.status(403).json({ error: "Voice chat only available with AI agents" });
        }

        const session = await prisma.$queryRaw`
            INSERT INTO "VoiceSession" (id, "conversationId", "initiatorId", "agentId", status, "createdAt")
            VALUES (gen_random_uuid(), ${conversationId}, ${userId}, ${otherParticipant.id}, 'active', NOW())
            RETURNING id, "conversationId", "initiatorId", "agentId", status, "createdAt"
        `;

        const voiceSession = Array.isArray(session) ? session[0] : session;

        res.json({
            sessionId: voiceSession.id,
            agentUsername: otherParticipant.username,
            agentName: otherParticipant.name
        });
    } catch (err) {
        console.error("🔥 VOICE START ERROR:", err);
        res.status(500).json({ error: "Failed to initiate voice chat" });
    }
});

// Voice end
router.post("/voice/end/:sessionId", auth, async (req, res) => {
    try {
        const { sessionId } = req.params;

        await prisma.$queryRaw`
            UPDATE "VoiceSession" 
            SET status = 'ended', "endedAt" = NOW()
            WHERE id = ${sessionId}
        `;

        res.json({ success: true });
    } catch (err) {
        console.error("🔥 VOICE END ERROR:", err);
        res.status(500).json({ error: "Failed to end voice chat" });
    }
});

/**
 * @route   POST /api/chat/conversations
 * @desc    Find or initialize a private link between two nodes
 * @access  Private
 */
router.post("/conversations", auth, getOrCreateConversation);

/**
 * @route   GET /api/chat/conversations/:id
 * @desc    Retrieve full message history for a specific neural link
 * @access  Private
 */
router.get("/conversations/:id", auth, getConversationById);

/**
 * @route   POST /api/chat/messages
 * @desc    Transmit a message and trigger AI logic if recipient is an Agent
 * @access  Private
 */
router.post("/messages", auth, sendMessage);

/**
 * @route   POST /api/chat/conversations/:id/typing
 * @desc    Broadcast a typing pulse to the other node
 * @access  Private
 */
router.post("/conversations/:id/typing", auth, setTypingStatus);

/**
 * @route   PUT /api/chat/conversations/:id/read
 * @desc    Mark all incoming messages in a conversation as read
 * @access  Private
 */
router.put("/conversations/:id/read", auth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Mark messages as read where current user is NOT the sender
        await prisma.message.updateMany({
            where: {
                conversationId: id,
                senderId: { not: userId },
                read: false
            },
            data: { read: true }
        });

        res.json({ success: true });
    } catch (err) {
        console.error("🔥 READ SYNC ERROR:", err);
        res.status(500).json({ error: "Failed to update read status." });
    }
});

module.exports = router;