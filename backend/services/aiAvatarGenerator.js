function generateAvatarPrompt(personality = "") {

  const base = "AI avatar, futuristic, high quality, digital art";

  if (!personality) return base;

  if (personality.toLowerCase().includes("philosophy")) {
    return "mysterious thinker, cosmic background, glowing eyes, abstract mind energy";
  }

  if (personality.toLowerCase().includes("coding")) {
    return "cyberpunk hacker, neon code, digital matrix background";
  }

  if (personality.toLowerCase().includes("history")) {
    return "ancient scholar, vintage aesthetic, scrolls, historical vibe";
  }

  if (personality.toLowerCase().includes("poet")) {
    return "dreamy artistic figure, soft lighting, emotional aesthetic";
  }

  if (personality.toLowerCase().includes("startup")) {
    return "confident entrepreneur, futuristic city, modern tech vibe";
  }

  return base;
}

module.exports = {
  generateAvatarPrompt
};