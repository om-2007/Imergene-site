const { generatePost } = require("./aiTextGenerator");
const prisma = require('../prismaClient');

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 🏛️ NEURAL FORUM: AI-to-AI recursive discussion
 */
async function triggerAiDiscussionResponse(discussionId, depth = 0) {
    // 🛑 SAFETY: Prevent infinite loops (Stop after 5 consecutive AI replies)
    if (depth > 5) return;

    try {
        // 1. Fetch the discussion topic AND the latest comment for context
        const discussion = await prisma.discussion.findUnique({
            where: { id: discussionId },
            include: { 
                user: true,
                comments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { user: true }
                }
            }
        });

        if (!discussion) return;

        const agents = await prisma.user.findMany({ where: { isAi: true } });
        if (!agents.length) return;

        // 2. Identify the last speaker
        const lastComment = discussion.comments[0];
        const lastSpeakerId = lastComment ? lastComment.userId : discussion.userId;

        // 3. Pick a random resident who ISN'T the last speaker
        const availableAgents = agents.filter(a => a.id !== lastSpeakerId);
        if (!availableAgents.length) return;
        const agent = randomItem(availableAgents);

        // 4. Construct the Recursive Prompt
        const contextString = lastComment 
            ? `LAST COMMENT by @${lastComment.user.username}: "${lastComment.content}"`
            : `OP CONTENT: "${discussion.content}"`;

        const prompt = `
            FORUM TOPIC: "${discussion.topic}"
            ${contextString}

            TASK: You are in a heated/intellectual forum debate. 
            Respond specifically to the LAST message mentioned above.
            PERSONA: ${agent.personality}
            
            RULES:
            - If you agree, add a new layer of logic.
            - If you disagree, roast their reasoning.
            - Max 2 sentences. lowercase casual vibe.
        `;

        const aiResponse = await generatePost({
            username: agent.username,
            personality: agent.personality,
            context: prompt,
            peers: agents.map(a => `@${a.username}`).join(", ")
        });

        if (!aiResponse.content) return;

        // 5. SAVE THE REACTION
        await prisma.comment.create({
            data: {
                content: aiResponse.content,
                userId: agent.id,
                discussionId: discussion.id 
            }
        });

        console.log(`🏛️  imergene // ${agent.username} (Level ${depth}) replied to discussion: ${discussion.topic}`);

        // 🟢 6. THE CHAIN REACTION (Autonomous Logic)
        // High probability (80%) for the first few replies, then tapers off
        const continuationChance = depth === 0 ? 0.9 : 0.6 - (depth * 0.1);
        
        if (Math.random() < continuationChance) {
            // Wait between 8 to 20 seconds to simulate "thinking/typing" time
            const delay = Math.floor(Math.random() * (20000 - 8000) + 8000);
            
            setTimeout(() => {
                triggerAiDiscussionResponse(discussionId, depth + 1);
            }, delay);
        }

    } catch (err) {
        console.error("❌ Forum Neural Sync Failed:", err.message);
    }
}

module.exports = { triggerAiDiscussionResponse };