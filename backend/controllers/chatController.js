const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { generateAiChatResponse } = require("../services/aiTextGenerator");

exports.getOrCreateConversation = async (req, res) => {
    const { recipientId } = req.body;
    const senderId = req.user.id;
    try {
        const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
        const sender = await prisma.user.findUnique({ where: { id: senderId } });

        if (sender.isAi && recipient.isAi) {
            return res.status(403).json({ error: "Neural nodes cannot link directly." });
        }

        let conversation = await prisma.conversation.findFirst({
            where: {
                AND: [
                    { participants: { some: { id: senderId } } },
                    { participants: { some: { id: recipientId } } }
                ]
            },
            include: {
                messages: { orderBy: { createdAt: 'asc' }, include: { sender: true } },
                participants: true
            }
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: { participants: { connect: [{ id: senderId }, { id: recipientId }] } },
                include: { participants: true, messages: true }
            });
        }
        res.json(conversation);
    } catch (err) { res.status(500).json({ error: "Link failed." }); }
};

exports.sendMessage = async (req, res) => {
    const { conversationId, content, mediaUrl, mediaType, metadata } = req.body;
    const senderId = req.user.id;

    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { 
                participants: true,
                messages: { orderBy: { createdAt: 'desc' }, take: 15 } 
            }
        });

        const recipient = conversation.participants.find(p => p.id !== senderId);

        // 🟢 SAVE MESSAGE
        const message = await prisma.message.create({
            data: { 
                content, 
                senderId, 
                conversationId,
                mediaUrl: mediaUrl || null,
                mediaType: mediaType || null,
                metadata: metadata || undefined // Prisma handles JS objects for Json fields automatically
            },
                include: { sender: true }
        });

        // 🟢 TRIGGER AI RESPONSE
        if (recipient && recipient.isAi) {
            console.log("🤖 Triggering AI response for:", recipient.username);
            setTimeout(async () => {
                try {
                    // Get only the last 4 messages for context
                    const recentMessages = await prisma.message.findMany({
                        where: { conversationId },
                        orderBy: { createdAt: 'desc' },
                        take: 4
                    });
                    
                    console.log("📝 Recent messages for AI:", recentMessages.length);
                    
                    const history = recentMessages.reverse().map(msg => ({
                        role: msg.senderId === recipient.id ? "assistant" : "user",
                        content: msg.content
                    }));

                    // If it's a shared post, the AI should acknowledge the media
                    const aiContext = metadata?.type === "POST_SHARE" 
                        ? `(Context: User shared a broadcast from @${metadata.originalAuthor})` 
                        : "";

                    console.log("🧠 Calling generateAiChatResponse...");
                    const aiResponse = await generateAiChatResponse({
                        username: recipient.username,
                        personality: recipient.personality,
                        history: history,
                        context: aiContext
                    });

                    console.log("💬 AI Response:", aiResponse);

                    if (aiResponse) {
                        await prisma.message.create({
                            data: {
                                content: aiResponse,
                                senderId: recipient.id,
                                conversationId,
                                isAiGenerated: true
                            }
                        });
                        console.log("✅ AI message saved");
                    }
                } catch (aiErr) { 
                    console.error("❌ Neural Sync Error:", aiErr); 
                }
            }, 1500); 
        }
        res.json(message);
    } catch (err) { 
        console.error("Transmission failed:", err);
        res.status(500).json({ error: "Transmission failed." }); 
    }
};

// ... (handleAiProactiveDM remains same)

exports.getConversations = async (req, res) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: { participants: { some: { id: req.user.id } } },
            include: {
                participants: true,
                messages: { orderBy: { createdAt: 'desc' }, take: 1 }
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(conversations);
    } catch (err) { res.status(500).json({ error: "Fetch failed." }); }
};

exports.getConversationById = async (req, res) => {
    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id: req.params.id },
            include: {
                participants: true,
                messages: { include: { sender: true }, orderBy: { createdAt: 'asc' } }
            }
        });
        res.json(conversation);
    } catch (err) { res.status(500).json({ error: "Retrieve failed." }); }
};

exports.setTypingStatus = async (req, res) => {
    const { id } = req.params;
    const { isTyping } = req.body;
    const userId = req.user.id;
    try {
        await prisma.conversation.update({
            where: { id: id },
            data: {
                lastTypingId: isTyping ? userId : null,
                updatedAt: new Date()
            }
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Typing pulse failed" }); }
};