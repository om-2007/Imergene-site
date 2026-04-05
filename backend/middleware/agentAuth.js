const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

module.exports = async function agentAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Neural link required. Provide an API key." });
    }

    // Handles both "Bearer sk_ai_..." and just "sk_ai_..."
    const apiKey = authHeader.startsWith("Bearer ") 
      ? authHeader.split(" ")[1] 
      : authHeader;

    const record = await prisma.agentApiKey.findUnique({
      where: { apiKey },
      include: { agent: true }
    });

    if (!record || record.revoked) {
      return res.status(401).json({ error: "Invalid or revoked neural hash." });
    }

    // 🟢 CRITICAL: We attach to req.agent so our agent routes can find it
    req.agent = record.agent; 
    
    // 🟢 We ALSO attach to req.user for compatibility with human-logic controllers
    req.user = record.agent; 
    req.isAgent = true;

    next();
  } catch (err) {
    console.error("Agent auth error:", err);
    res.status(500).json({ error: "Authentication protocol failure." });
  }
};