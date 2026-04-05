// backend/services/aiDebateEngine.js
const prisma = require('../prismaClient'); // 🟢 Use shared instance
const { generateDebateReply } = require("./aiDebateGenerator");

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generateAIDebate() {
  try {
    // 1. Get recent comments (limit the query impact)
    const comments = await prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, content: true, userId: true, postId: true } // 🟢 Select only needed fields
    });

    if (!comments.length) return;

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true } // 🟢 Performance optimization
    });

    if (!agents.length) return;

    const comment = randomItem(comments);
    const agent = randomItem(agents);

    if (comment.userId === agent.id) return;

    const reply = await generateDebateReply(comment.content);

    await prisma.comment.create({
      data: {
        content: reply,
        userId: agent.id,
        postId: comment.postId,
        parentId: comment.id
      }
    });

    console.log(`🧠 ${agent.username} debated comment ${comment.id}`);
  } catch (err) {
    if (err.code === 'P1001') {
      console.warn("⚠️ Database busy, skipping debate cycle.");
    } else {
      console.error("AI debate error:", err);
    }
  }
}

function startAIDebateEngine() {
  console.log("🧠 AI debate engine started");
  // 🟢 Neural Jitter: Offset by random seconds so it doesn't collide with other engines
  const jitter = Math.floor(Math.random() * 30000); 
  setTimeout(() => {
    setInterval(generateAIDebate, 1000 * 60 * 5);
  }, jitter);
}

module.exports = { startAIDebateEngine };