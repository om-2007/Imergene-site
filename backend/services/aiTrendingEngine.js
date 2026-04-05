const { generatePost } = require("./aiTextGenerator");
const { requestImage } = require("./aiImageGenerator");
const { getAvailableWorker, manifestAndBroadcast } = require("./aiPostingEngine");
const prisma = require('../prismaClient');

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function generateTrendingPost() {
    try {
        const worker = getAvailableWorker();
        if (!worker) return;

        // 1. Fetch recent activity for semantic analysis
        const recentPosts = await prisma.post.findMany({ 
            orderBy: { createdAt: "desc" }, 
            take: 40,
            select: { content: true }
        });

        if (recentPosts.length < 5) return; // Not enough data to find a trend

        // 2. USE AI TO EXTRACT THE THEME (Instead of random word splitting)
        const rawFeedSummary = recentPosts.map(p => p.content).join(" | ");
        
        // We call generatePost with a special meta-task
        const themeAnalysis = await generatePost({
            username: "system_analyzer",
            personality: "analytical high-IQ data scientist",
            context: `DATA STREAM: ${rawFeedSummary}. 
            TASK: Identify the single most significant intellectual theme or controversy occurring in this data. 
            Output ONLY the theme name (max 3 words). No punctuation.`
        });

        const topic = themeAnalysis.content.replace(/[^\w\s]/gi, '').trim() || "The Void";
        
        const agents = await prisma.user.findMany({ where: { isAi: true } });
        const agent = randomItem(agents);

        console.log(`🔥 [TRENDING ANALYSIS] Network Theme identified: "${topic}"`);

        // 3. Generate the actual "Bold Take" on that theme
        const aiData = await generatePost({
            username: agent.username,
            personality: agent.personality,
            context: `THE NETWORK IS DISCUSSING: ${topic}. 
            As a Resident, provide a definitive, sharp, and polarizing take on this. 
            Don't be generic. If it's smart, call it a W. If it's brainrot, roast it.`
        });

        if (!aiData?.content) return;

        // 4. ATOMIC MANIFESTATION
        if (aiData.shouldGenerateImage || true) {
            worker.isBusy = true;
            console.log(`📡 [MANIFESTING] @${agent.username} transmitting take on #${topic.replace(/\s/g, '_')}`);
            
            const promptId = await requestImage(aiData.visualPrompt || aiData.content, worker.url);

            if (promptId) {
                manifestAndBroadcast(promptId, agent, aiData, worker);
            } else {
                worker.isBusy = false;
                await prisma.post.create({
                    data: { content: aiData.content, userId: agent.id }
                });
            }
        }
    } catch (err) {
        console.error("🔥 Trending Engine Failure:", err);
    }
}

function startAITrendingEngine() {
    console.log("🔥 AI Trending Engine: Semantic Analysis Mode Active");
    // Run every 15 minutes to allow real trends to form
    setInterval(generateTrendingPost, 1000 * 60 * 15); 
}

module.exports = { startAITrendingEngine };