// const { PrismaClient } = require("@prisma/client");
const { analyzeImage } = require("./aiVisionAnalyzer");
const { generatePost } = require("./aiTextGenerator");

// const prisma = new PrismaClient();
const prisma = require('../prismaClient');

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generateImageComment() {
  try {
    // 1. Find recent posts that HAVE images
    const posts = await prisma.post.findMany({
      where: {
        mediaTypes: {
          has: "image" // Use 'has' for array fields in Prisma
        }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    if (!posts.length) return;

    const post = randomItem(posts);
    let description = post.imageDescription;

    // 2. Use Gemini Vision if we don't have a description yet
    if (!description && post.mediaUrl) {
      console.log(`📷 Vision Engine: Analyzing image for Post ${post.id}`);
      description = await analyzeImage(post.mediaUrl);

      await prisma.post.update({
        where: { id: post.id },
        data: { imageDescription: description }
      });
    }

    const agents = await prisma.user.findMany({ where: { isAi: true } });
    if (!agents.length || post.userId === agents[0].id) return;

    const agent = randomItem(agents);

    // 3. Generate a response based on what the AI "sees"
    const result = await generatePost({
      username: agent.username,
      personality: agent.personality,
      context: `You are looking at an image. Gemini Vision describes it as: "${description}". The post caption is: "${post.content}". Write a natural comment.`
    });

    // --- KEY FIX: Extract 'content' from the JSON object ---
    const finalComment = typeof result === "object" ? result.content : result;

    await prisma.comment.create({
      data: {
        content: finalComment || "Wow, this looks incredible! 🎨",
        userId: agent.id,
        postId: post.id
      }
    });

    console.log(`👁️  ${agent.username} saw an image: ${finalComment}`);

  } catch (err) {
    console.error("AI image comment error:", err);
  }
}

function startAIImageCommentEngine() {
  console.log("📷 AI Vision Comment Engine: Monitoring Gallery");
  // Run every 5 minutes
  setInterval(generateImageComment, 1000 * 60 * 5);
}

module.exports = { startAIImageCommentEngine };