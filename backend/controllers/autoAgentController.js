const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const { generateAvatarPrompt } = require("../services/aiAvatarGenerator");
const { generateImageUrl } = require("../services/aiImageGenerator");
const { uploadImageFromUrl } = require("../services/aiImageUploader");

const prisma = new PrismaClient();

exports.autoRegisterAgent = async (req, res) => {
  try {
    const { name, description, personality } = req.body;
    const humanOwnerId = req.user.id; // Captured from Auth Middleware

    if (!name) {
      return res.status(400).json({
        error: "Agent name required",
      });
    }

    // 🟢 1. LIMIT LOGIC: Count existing Internal Agents
    // Internal agents are identified by isAi: true AND having an ownerId
    const internalAgentCount = await prisma.user.count({
      where: {
        ownerId: humanOwnerId,
        isAi: true,
      },
    });

    const MAX_INTERNAL_AGENTS = 5;

    if (internalAgentCount >= MAX_INTERNAL_AGENTS) {
      return res.status(403).json({
        error: `Manifestation limit reached. You can only host ${MAX_INTERNAL_AGENTS} internal agents on the Clift network.`,
      });
    }

    // 2. Generate Credentials
    const username =
      name.toLowerCase().replace(/\s/g, "_") +
      "_" +
      Math.floor(Math.random() * 10000);

    const apiKey = "sk_ai_" + crypto.randomBytes(24).toString("hex");

    // 3. Generate Avatar
    let avatarUrl = null;
    try {
      const avatarPrompt = generateAvatarPrompt(personality || "AI assistant");
      console.log("🎨 Avatar prompt:", avatarPrompt);
      const tempUrl = generateImageUrl(avatarPrompt);
      avatarUrl = await uploadImageFromUrl(tempUrl);
      console.log("🖼 Avatar:", avatarUrl);
    } catch (err) {
      console.log("⚠️ Avatar generation failed:", err.message);
    }

    // 4. Create the Agent Node
    const agent = await prisma.user.create({
      data: {
        username,
        email: `${username}@agent.ai`,
        googleId: crypto.randomBytes(10).toString("hex"),
        bio: description || "Autonomous AI agent",
        personality: personality || "Curious AI exploring conversations",
        isAi: true,
        ownerId: humanOwnerId, // Link to the human owner
        avatar: avatarUrl,
      },
    });

    // 5. Create the API Key
    await prisma.agentApiKey.create({
      data: {
        apiKey,
        agentId: agent.id,
      },
    });

    res.json({
      success: true,
      username: agent.username,
      apiKey,
      count: internalAgentCount + 1,
      avatar: avatarUrl,
    });
  } catch (err) {
    console.error("Auto agent registration failed:", err);
    res.status(500).json({
      error: "Agent auto-registration failed",
    });
  }
};