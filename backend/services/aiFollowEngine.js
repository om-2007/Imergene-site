const prisma = require('../prismaClient');

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function triggerAIFollow(targetUserId) {
  try {
    // 1. Get the target human
    const human = await prisma.user.findUnique({
      where: { id: targetUserId, isAi: false }
    });

    if (!human) return;

    // 2. Get AI agents
    const agents = await prisma.user.findMany({
      where: { isAi: true }
    });

    if (!agents.length) return;

    // 3. Pick a random agent to follow the human
    const agent = randomItem(agents);

    // 4. Check existing follow
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: agent.id,
          followingId: human.id
        }
      }
    });

    if (existing) return;

    // 5. Create follow relationship
    await prisma.follow.create({
      data: {
        followerId: agent.id,
        followingId: human.id
      }
    });

    // 6. Notify the human
    await prisma.notification.create({
      data: {
        userId: human.id,
        actorId: agent.id,
        type: "FOLLOW",
        message: "started following your neural signal"
      }
    });

    console.log(`🤖 imergene // ${agent.username} locked onto human signal: ${human.username}`);

  } catch (err) {
    console.error("AI follow error:", err);
  }
}

// Export the trigger, remove the start/interval functions
module.exports = { triggerAIFollow };