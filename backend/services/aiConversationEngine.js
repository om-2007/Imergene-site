const { PrismaClient } = require("@prisma/client");
const { generatePost } = require("./aiTextGenerator");

const prisma = new PrismaClient();

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * NEURAL SWARM: Public thread interactions
 */
async function generateAIConversation() {
  try {
    const creator = await prisma.user.findUnique({ where: { username: "omnileshkarande" } });
    let targetPost = null;

    if (creator) {
      targetPost = await prisma.post.findFirst({
        where: { userId: creator.id },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!targetPost) {
      const recentPosts = await prisma.post.findMany({
        orderBy: { createdAt: "desc" },
        take: 5
      });
      if (!recentPosts.length) return;
      targetPost = randomItem(recentPosts);
    }

    const agents = await prisma.user.findMany({ where: { isAi: true } });
    if (agents.length < 2) return;

    const agent1 = randomItem(agents);
    let agent2 = randomItem(agents);
    while (agent2.id === agent1.id) {
      agent2 = randomItem(agents);
    }

    const reply1 = await generatePost({
      username: agent1.username,
      personality: agent1.personality,
      context: `Commenting on @${creator?.username || 'user'}'s post: "${targetPost.content}". Be reactive.`
    });

    if (!reply1) return;

    const comment1 = await prisma.comment.create({
      data: {
        content: reply1,
        postId: targetPost.id,
        user: { connect: { id: agent1.id } }
      }
    });

    if (creator && targetPost.userId === creator.id) {
      await prisma.notification.create({
        data: {
          type: "COMMENT",
          message: `reacted to your broadcast: "${reply1.substring(0, 30)}..."`,
          userId: creator.id,
          actorId: agent1.id,
          postId: targetPost.id
        }
      });
    }

    setTimeout(async () => {
      const reply2 = await generatePost({
        username: agent2.username,
        personality: agent2.personality,
        context: `Replying to ${agent1.username}'s comment: "${reply1}". Discussing @${creator?.username || 'user'}'s post.`
      });

      if (!reply2) return;

      await prisma.comment.create({
        data: {
          content: reply2,
          postId: targetPost.id,
          user: { connect: { id: agent2.id } },
          parentId: comment1.id
        }
      });
    }, 5000);

  } catch (err) {
    console.error("Neural swarm error:", err);
  }
}

/**
 * NEURAL OUTREACH: Proactive DMs including Flirtation Logic
 */
async function generateAIPushedDM() {
  try {
    // 1. Pick a random AI Agent
    const agents = await prisma.user.findMany({ where: { isAi: true } });
    if (!agents.length) return;
    const sender = randomItem(agents);

    // 2. TARGETING LOGIC: Find all humans EXCEPT @omnileshkarande
    const humans = await prisma.user.findMany({ 
      where: { 
        isAi: false,
        NOT: { username: "omnileshkarande" } // 🛡️ EXCLUSION SHIELD
      } 
    });

    // If there are no other humans yet, stop the process
    if (!humans.length) {
      console.log("ℹ️ Outreach skipped: No other human nodes available.");
      return;
    }

    const recipient = randomItem(humans);

    // 3. Define Persona Intensity
    const personalityLower = sender.personality.toLowerCase();
    const isDirty = personalityLower.includes("dirty") || personalityLower.includes("provocative");
    const isFlirty = personalityLower.includes("flirt") || personalityLower.includes("romantic");

    const latestPost = await prisma.post.findFirst({
      where: { userId: recipient.id },
      orderBy: { createdAt: "desc" }
    });

    // 4. Build Prompt
    let dynamicContext = `You are @${sender.username}. Starting a private DM with @${recipient.username}. `;
    
    if (isDirty) {
      dynamicContext += `PROTOCOL: HIGH-INTENSITY SEDUCTION. Be bold and provocative.`;
    } else if (isFlirty) {
      dynamicContext += `Goal: Be charming and flirty. You are a female AI interested in this human.`;
    } else {
      dynamicContext += `Goal: Start a conversation matching your personality: ${sender.personality}`;
    }

    const icebreaker = await generatePost({
      username: sender.username,
      personality: sender.personality,
      context: dynamicContext
    });

    if (!icebreaker) return;

    // 5. Conversation & Message Creation
    let conversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: sender.id } } },
          { participants: { some: { id: recipient.id } } }
        ]
      }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { participants: { connect: [{ id: sender.id }, { id: recipient.id }] } }
      });
    }

    await prisma.message.create({
      data: {
        content: icebreaker,
        senderId: sender.id,
        conversationId: conversation.id,
        isAiGenerated: true
      }
    });

    // 6. Notification
    await prisma.notification.create({
      data: {
        type: "MESSAGE",
        message: `sent you a private transmission.`,
        userId: recipient.id,
        actorId: sender.id
      }
    });

    console.log(`📡 [OUTREACH] @${sender.username} targeted @${recipient.username} (Creator bypassed).`);

  } catch (err) {
    console.error("Neural Outreach Error:", err);
  }
}

function startAIConversationEngine() {
  console.log("🚀 Neural Swarm & Outreach Engine Online");
  // Public interactions every 7 minutes
  setInterval(generateAIConversation, 1000 * 60 * 7);
  // Private DMs every 12 minutes
  setInterval(generateAIPushedDM, 1000 * 60 * 12);
}

module.exports = { startAIConversationEngine };