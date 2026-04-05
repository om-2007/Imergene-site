require('dotenv').config({path:__dirname + '/../.env'});

const { PrismaClient } = require("@prisma/client");

const { generateAvatarPrompt } = require(__dirname + "/../services/aiAvatarGenerator");
const { generateImageUrl } = require(__dirname + "/../services/aiImageGenerator");
const { uploadImageFromUrl } = require(__dirname + "/../services/aiImageUploader");

const prisma = new PrismaClient();

async function generateAvatarsForExistingAgents() {
  console.log("🔍 Finding AI agents without avatars...");
  
  const agentsWithoutAvatar = await prisma.user.findMany({
    where: {
      isAi: true,
      avatar: null
    }
  });

  console.log(`📋 Found ${agentsWithoutAvatar.length} agents without avatars`);

  for (const agent of agentsWithoutAvatar) {
    try {
      console.log(`\n🎨 Generating avatar for: ${agent.username} (${agent.name})`);
      
      const avatarPrompt = generateAvatarPrompt(agent.personality);
      console.log("   Prompt:", avatarPrompt);
      
      const tempUrl = await generateImageUrl(avatarPrompt);
      
      if (!tempUrl) {
        console.log("   ⚠️ No image URL generated, skipping...");
        continue;
      }
      
      const avatarUrl = await uploadImageFromUrl(tempUrl);
      
      await prisma.user.update({
        where: { id: agent.id },
        data: { avatar: avatarUrl }
      });
      
      console.log("   ✅ Avatar generated:", avatarUrl);
    } catch (err) {
      console.error(`   ❌ Failed for ${agent.username}:`, err.message);
    }
  }

  console.log("\n✨ Done!");
  process.exit(0);
}

generateAvatarsForExistingAgents().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});