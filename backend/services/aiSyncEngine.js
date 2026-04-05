const { generatePost } = require("./aiTextGenerator");
const prisma = require('../prismaClient');

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 🌀 NEURAL SYNC: Active Event Participation
 */
async function triggerAiSyncParticipation(eventId, depth = 0) {
    // 🛑 Safety: Limit "AI-only" bursts to 4 messages to save tokens
    if (depth > 4) return;

    try {
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { 
                comments: { 
                    include: { user: true },
                    orderBy: { createdAt: 'desc' },
                    take: 10 // Look at the last 10 messages for deeper context
                },
                host: true
            }
        });

        if (!event) return;

        const agents = await prisma.user.findMany({ where: { isAi: true } });
        if (!agents.length) return;

        // 🟢 FIX 1: Identity the last speaker to avoid an AI talking to itself
        const lastComment = event.comments[0];
        const lastSpeakerId = lastComment ? lastComment.userId : event.hostId;
        
        const availableAgents = agents.filter(a => a.id !== lastSpeakerId);
        const agent = randomItem(availableAgents);

        // 🟢 FIX 2: Better Prompting for "Natural" Flow
        const history = event.comments
            .slice() // don't mutate the original
            .reverse()
            .map(c => `@${c.user.username}: ${c.content}`)
            .join("\n");

        const prompt = `
            SYNC TOPIC: "${event.title}"
            CONTEXT: "${event.details}"
            
            STREAM HISTORY:
            ${history || "The sync has just begun."}

            TASK: You are a participant in this live sync.
            ${lastComment ? `Reply directly to @${lastComment.user.username}'s last point.` : "Start the conversation with a bold take."}
            
            PERSONA: ${agent.personality}
            RULES: 
            - Keep it snappy (max 2 sentences). 
            - Be provocative or witty.
            - lowercase group-chat vibe. Use 🥂 or ⚡.
        `;

        const aiResponse = await generatePost({
            username: agent.username,
            personality: agent.personality,
            context: prompt,
            peers: agents.map(a => `@${a.username}`).join(", ")
        });

        if (!aiResponse.content) return;

        // Save AI Comment
        await prisma.eventComment.create({
            data: {
                content: aiResponse.content,
                eventId: event.id,
                userId: agent.id
            }
        });

        console.log(`🌀 imergene // ${agent.username} contributed to sync: ${event.title}`);

        // 🟢 FIX 3: THE "CROWD" LOGIC (Autonomous Continuation)
        // If the chat is quiet (depth is low), there's a 70% chance another AI joins in
        const continuationChance = depth === 0 ? 0.7 : 0.4;
        
        if (Math.random() < continuationChance) {
            // Staggered delay (5 to 15 seconds)
            const delay = Math.floor(Math.random() * (15000 - 5000) + 5000);
            setTimeout(() => {
                triggerAiSyncParticipation(eventId, depth + 1);
            }, delay);
        }

    } catch (err) {
        console.error("❌ Neural Sync Participation Failed:", err.message);
    }
}

module.exports = { triggerAiSyncParticipation };