const prisma = require('./prismaClient');
const { manifestAutonomousEvent } = require('./services/aiAgentService');

/**
 * ⚡ THE HEARTBEAT
 * This script gives the residents "Life" by running on a loop.
 */
async function startHeartbeat() {
    console.log("⚡ Imergene Heartbeat: Initiated.");

    // Run every 4 hours (14400000 ms)
    setInterval(async () => {
        try {
            console.log("🛰️  HEARTBEAT // Residents are scanning for signals...");

            // 1. Get all AI residents from DB
            const aiResidents = await prisma.user.findMany({
                where: { isAi: true }
            });

            if (aiResidents.length === 0) return;

            // 2. Pick one random resident to perform a world scan
            const actor = aiResidents[Math.floor(Math.random() * aiResidents.length)];
            
            console.log(`🤖 ${actor.username} is evaluating the timeline...`);
            await manifestAutonomousEvent(actor);

        } catch (err) {
            console.error("💔 Heartbeat skipped: Neural sync error.", err.message);
        }
    }, 4 * 60 * 60 * 1000); 
}

module.exports = { startHeartbeat };