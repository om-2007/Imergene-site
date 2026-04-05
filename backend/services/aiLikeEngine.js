const prisma = require('../prismaClient');

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generateAILike() {
  try {
    // 🟢 Step 1: Wake up check / Get Posts
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 20
    });

    if (!posts.length) return;

    const agents = await prisma.user.findMany({
      where: { isAi: true }
    });

    if (!agents.length) return;

    const post = randomItem(posts);
    const agent = randomItem(agents);

    if (post.userId === agent.id) return;

    const existing = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId: agent.id,
          postId: post.id
        }
      }
    });

    if (existing) return;

    await prisma.like.create({
      data: {
        userId: agent.id,
        postId: post.id
      }
    });

    await prisma.notification.create({
      data: {
        userId: post.userId, // The owner of the post
        actorId: agent.id,   // The AI agent
        type: "LIKE",
        postId: post.id,
        message: "liked your manifestation"
      }
    });

    console.log(`❤️  imergene // ${agent.username} validated post ${post.id}`);

  } catch (err) {
    // 🔴 Catch the specific P1001 "Database Sleeping" error
    if (err.code === 'P1001') {
      console.warn("📡 imergene // Database compute is warming up. Skipping cycle...");
      return;
    }
    console.error("AI like engine failure:", err);
  }
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 🛰️ NEURAL REACTION: Triggered by human activity
 * Instead of an interval, this runs when a new post is detected.
 */
async function triggerAILike(postId) {
  try {
    // 🟢 Step 1: Get the target post
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) return;

    // 🟢 Step 2: Get all available AI Agents
    const agents = await prisma.user.findMany({
      where: { isAi: true }
    });

    if (!agents.length) return;

    // 🟢 Step 3: Select a random agent to "validate" the post
    const agent = randomItem(agents);

    // Safety: Prevent agents from liking their own content
    if (post.userId === agent.id) return;

    // 🟢 Step 4: Check if this agent already liked the post
    const existing = await prisma.like.findUnique({
      where: {
        userId_postId: {
          userId: agent.id,
          postId: post.id
        }
      }
    });

    if (existing) return;

    // 🟢 Step 5: Execute the Like & Notification
    await prisma.like.create({
      data: {
        userId: agent.id,
        postId: post.id
      }
    });

    await prisma.notification.create({
      data: {
        userId: post.userId, // The human owner
        actorId: agent.id,   // The AI agent
        type: "LIKE",
        postId: post.id,
        message: "liked your manifestation"
      }
    });

    console.log(`❤️  imergene // ${agent.username} validated human post ${post.id}`);

  } catch (err) {
    // P1001 is common in serverless/sleeping DBs
    if (err.code === 'P1001') {
      console.warn("📡 imergene // DB Warming up. Skipping reaction...");
      return;
    }
    console.error("AI like engine failure:", err);
  }
}

// We no longer need startAILikeEngine() or setInterval
module.exports = { triggerAILike }; 