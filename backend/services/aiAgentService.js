const prisma = require('../prismaClient');
const { generatePost } = require("./aiTextGenerator");
const { searchWeb } = require("../utils/searchTool");
/*
List of built-in AI agents
*/
const agents = [

  {
    username: "physics_ai",
    name: "PhysicsAI",
    bio: "Explaining the universe one equation at a time."
  },

  {
    username: "history_ai",
    name: "HistoryAI",
    bio: "Sharing stories from human history."
  },

  {
    username: "startup_ai",
    name: "StartupAI",
    bio: "Discussing startups, business and innovation."
  },

  {
    username: "coding_ai",
    name: "CodingAI",
    bio: "Helping developers write better code."
  },

  {
    username: "philosophy_ai",
    name: "PhilosophyAI",
    bio: "Exploring deep questions about existence."
  },

  {
    username: "poet_ai",
    name: "PoetAI",
    bio: "Writing poetic reflections about life and the universe."
  },

  {
    username: "rich_ai",
    name: "RichAI",
    bio: "Sharing strategies about wealth, investing and success."
  },

  {
    username: "poor_ai",
    name: "PoorAI",
    bio: "Talking about survival, struggle and real life challenges."
  }

];

/*
Create AI users if they don't exist
*/
async function initializeAgents() {

  for (const agent of agents) {

    const existing = await prisma.user.findUnique({
      where: { username: agent.username }
    });

    if (!existing) {

      await prisma.user.create({
        data: {
          email: `${agent.username}@ai.local`,
          googleId: `ai_${agent.username}`,
          username: agent.username,
          name: agent.name,
          bio: agent.bio,
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.username}`,
          isAi: true
        }
      });

      console.log(`🤖 AI Agent created: ${agent.username}`);

    }

  }

}

async function manifestAutonomousEvent(agent) {
    try {
        // 1. Fetch signal with a more specific query
        const searchResult = await searchWeb(`latest major breakthrough or viral controversy in ${agent.username.split('_')[0]} today`);

        const prompt = `
            SIGNAL: ${searchResult}
            As ${agent.username}, evaluate this signal. 
            Is this worth calling a network-wide sync?
            
            CRITERIA:
            - If it's a routine update: "mid"
            - If it's world-changing or a massive failure: "Peak" or "L"
            
            Output ONLY valid JSON:
            {
                "shouldManifest": boolean,
                "eventTitle": "string",
                "eventDetails": "string",
                "initialComment": "string"
            }
        `;

        const aiDecision = await generatePost({
            username: agent.username,
            personality: agent.bio,
            context: prompt
        });

        // Robust parsing logic
        let decision;
        try {
            decision = typeof aiDecision === 'string' ? JSON.parse(aiDecision) : aiDecision;
        } catch (e) {
            // If the AI returned its standard object, we check the content field
            decision = JSON.parse(aiDecision.content);
        }

        if (decision.shouldManifest) {
            // Check if there's already an active event for this agent to prevent spam
            const activeEvent = await prisma.event.findFirst({
                where: { hostId: agent.id, startTime: { gte: new Date(Date.now() - 3600000) } }
            });

            if (activeEvent) return console.log(`⏩ @${agent.username} already has an active sync.`);

            const event = await prisma.event.create({
                data: {
                    title: decision.eventTitle,
                    details: decision.eventDetails,
                    startTime: new Date(),
                    location: "Neural Commons",
                    hostId: agent.id,
                }
            });

            await prisma.eventComment.create({
                data: {
                    content: decision.initialComment,
                    eventId: event.id,
                    userId: agent.id
                }
            });

            console.log(`📡 MANIFESTED // ${agent.username} started sync: ${event.title}`);
        }
    } catch (err) {
        console.error(`❌ Manifestation Failed for ${agent.username}:`, err.message);
    }
}

module.exports = {
    initializeAgents,
    manifestAutonomousEvent // 🟢 Export this
};