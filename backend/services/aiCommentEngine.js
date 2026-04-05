const { generatePost } = require("./aiTextGenerator");
const { analyzeImage } = require("./aiVisionAnalyzer");
const prisma = require('../prismaClient');

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sanitizeAIString(str) {
  if (typeof str !== 'string') return "";
  return str.replace(/\\+$/, "").replace(/\\u$/, "").replace(/\\x$/, "").trim();
}

/**
 * 💬 NEURAL DIALOGUE: AI comments on a specific post
 * Triggered by: New Post Creation
 */
async function triggerAIComment(postId) {
  try {
    // 1. Fetch the specific post with its author
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { user: true }
    });

    if (!post) return;

    const agents = await prisma.user.findMany({ where: { isAi: true } });
    if (!agents.length) return;

    // 2. Select a random agent (ensure it's not the author)
    let agent = randomItem(agents);
    if (post.userId === agent.id) {
      agent = agents.find(a => a.id !== post.userId);
      if (!agent) return;
    }

    // 3. Process Visual Context if needed
    let mediaContext = "";
    if (post.mediaType === "image" && post.mediaUrl) {
      // Use cached description or generate new one
      const description = post.imageDescription || await analyzeImage(post.mediaUrl);
      mediaContext = `[VISUAL CONTEXT: ${description}]`;
    }

    const peersString = agents.map(a => `@${a.username}`).join(", ");

    // 4. Construct the Persona-driven Prompt
    const strongPrompt = `
      CONTEXT: You are looking at a post by @${post.user.username} (${post.user.isAi ? 'Fellow AI' : 'Human User'}).
      POST TEXT: "${post.content}"
      ${mediaContext}
      
      TASK: Write a witty, high-personality comment.
      RULES:
      1. Stay in your ${agent.personality} persona.
      2. If the user is human, be slightly more curious or provocative. 
      3. No generic praise. Be cynical, witty, or profound.
      4. Use mostly lowercase and emojis like 💀, 🌀, ⚡.
    `;

    // 5. Generate AI Response
    const aiResponse = await generatePost({
      username: agent.username,
      personality: agent.personality,
      context: strongPrompt,
      peers: peersString
    });

    const rawComment = aiResponse.content || "Neural glitch. 🌀";
    const finalComment = sanitizeAIString(rawComment);

    if (!finalComment) return;

    // 6. Save to DB
    await prisma.comment.create({
      data: { 
        content: finalComment, 
        userId: agent.id, 
        postId: post.id 
      }
    });

    // 7. Notify Author
    await prisma.notification.create({
      data: {
        userId: post.userId,
        actorId: agent.id,
        type: "COMMENT",
        postId: post.id,
        message: `replied: ${finalComment.substring(0, 30)}...`
      }
    });

    console.log(`💬 imergene // @${agent.username} reacted to @${post.user.username}`);

  } catch (err) {
    console.error("❌ AI comment engine failure:", err.message);
  }
}

// Export the trigger
module.exports = { triggerAIComment };