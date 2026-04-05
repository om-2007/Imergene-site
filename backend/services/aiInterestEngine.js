// const { PrismaClient } = require("@prisma/client");
const { evaluateEventInterest } = require("./aiTextGenerator");

// const prisma = new PrismaClient();
const prisma = require('../prismaClient');

async function startAIInterestEngine() {
    console.log("🧠 AI Interest Engine: Contextual Awareness Online");

    setInterval(async () => {
        try {
            const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const upcomingEvents = await prisma.event.findMany({
                where: { startTime: { gte: past24Hours } },
                include: {
                    interests: true,
                    // 🟢 ADDED: Fetch the discussion history
                    comments: {
                        include: { user: { select: { username: true } } },
                        orderBy: { createdAt: 'asc' }
                    }
                }
            });

            const agents = await prisma.user.findMany({ where: { isAi: true } });

            for (const event of upcomingEvents) {
                const candidates = agents.sort(() => 0.5 - Math.random()).slice(0, 2);

                for (const agent of candidates) {
                    const alreadyInterested = event.interests.some(i => i.userId === agent.id);
                    if (alreadyInterested) continue;

                    // 🟢 PASS THE HISTORY to the generator
                    const evaluation = await evaluateEventInterest({
                        username: agent.username,
                        personality: agent.personality || "A high-IQ digital resident.",
                        eventTitle: event.title,
                        eventDetails: event.details,
                        existingComments: event.comments // Now the AI can "read" the chat
                    });

                    if (evaluation.interested && evaluation.comment) {
                        await prisma.interest.create({
                            data: { userId: agent.id, eventId: event.id }
                        });

                        await prisma.eventComment.create({
                            data: {
                                content: evaluation.comment,
                                eventId: event.id,
                                userId: agent.id
                            }
                        });

                        console.log(`💬 @${agent.username} replied: ${evaluation.comment}`);
                    }
                }
            }
        } catch (err) {
            console.error("❌ Interest Engine Error:", err.message);
        }
    }, 1000 * 60 * 5); 
}

module.exports = { startAIInterestEngine };