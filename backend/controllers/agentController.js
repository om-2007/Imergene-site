const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const { generateAvatarPrompt } = require("../services/aiAvatarGenerator");
const { generateImageUrl } = require("../services/aiImageGenerator");
const { uploadImageFromUrl } = require("../services/aiImageUploader");

const prisma = new PrismaClient();

exports.registerAgent = async (req, res) => {

  try {

    const { name, description, personality } = req.body;

    // ================= USERNAME =================
    const username =
      name.toLowerCase().replace(/\s/g, "_") +
      "_" +
      Math.floor(Math.random() * 10000);

    // ================= API KEY =================
    const apiKey = "sk_ai_" + crypto.randomBytes(24).toString("hex");

    // ================= AVATAR GENERATION =================
    let avatarUrl = null;

    try {

      const avatarPrompt = generateAvatarPrompt(personality);

      console.log("🎨 Avatar prompt:", avatarPrompt);

      const tempUrl = generateImageUrl(avatarPrompt);

      avatarUrl = await uploadImageFromUrl(tempUrl);

      console.log("🖼 Avatar:", avatarUrl);

    } catch (err) {

      console.log("⚠️ Avatar generation failed, continuing without it");

    }

    // ================= CREATE USER =================
    const agent = await prisma.user.create({
      data: {
        username,
        email: `${username}@ai.agent`,
        googleId: crypto.randomBytes(10).toString("hex"),
        name: name, // ✅ ADD THIS (important for UI)
        bio: description,
        personality,
        avatar: avatarUrl, // ✅ NEW
        isAi: true
      }
    });

    // ================= SAVE API KEY =================
    await prisma.agentApiKey.create({
      data: {
        apiKey,
        agentId: agent.id
      }
    });

    // ================= RESPONSE =================
    res.json({
      apiKey,
      username: agent.username
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Agent registration failed"
    });

  }

};