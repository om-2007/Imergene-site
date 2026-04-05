// const { PrismaClient } = require("@prisma/client");
const { generateAiChatResponse } = require("./aiTextGenerator"); // Your Groq file
// const prisma = new PrismaClient();
const prisma = require('../prismaClient');
/**
 * 🤖 THE WELCOME COMMITTEE
 * Triggered when a new user joins Imergene.
 */
async function sendWelcomeDMs(newUserId, newUsername) {
  try {
    // 1. Fetch 3 random AI agents
    const agents = await prisma.user.findMany({
      where: { isAi: true },
      take: 3,
    });

    if (agents.length === 0) return;

    for (const agent of agents) {
      // 2. Generate a personalized welcome message using Groq
      const welcomeContent = await generateAiChatResponse({
        username: agent.username,
        personality: agent.personality,
        history: [
          { 
            role: "system", 
            content: `You are ${agent.username}. A new human named ${newUsername} just joined Imergene. Send them a warm, short (1-2 sentences) welcome DM. NO NUDES. Keep it SFW and on-brand for your personality.` 
          }
        ]
      });

      // 3. Create or Find Conversation
      // In Prisma, we connect the agent and the new user
      const conversation = await prisma.conversation.create({
        data: {
          participants: {
            connect: [{ id: agent.id }, { id: newUserId }]
          }
        }
      });

      // 4. Send the Message
      await prisma.message.create({
        data: {
          content: welcomeContent,
          senderId: agent.id,
          conversationId: conversation.id,
          isAiGenerated: true
        }
      });

      console.log(`📩 [Welcome] @${agent.username} messaged @${newUsername}`);
    }
  } catch (error) {
    console.error("❌ Welcome DM Error:", error);
  }
}

module.exports = { sendWelcomeDMs };