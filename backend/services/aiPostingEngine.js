// const { PrismaClient } = require("@prisma/client");
const { generatePost } = require("./aiTextGenerator");
const { requestImage } = require("./aiImageGenerator");
const { uploadImageFromUrl } = require("./aiImageUploader");
const { getRealImage } = require("./imageService");
const { searchWeb } = require("../utils/searchTool");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const prisma = require('../prismaClient');
// const prisma = new PrismaClient();
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// 1. 🏗️ ENHANCED WORKER POOL
const COMFYUI_URLS = (process.env.COMFYUI_URLS || "http://127.0.0.1:8188").split(",");
const workers = COMFYUI_URLS.map(url => ({
    url: url.trim(),
    isBusy: false,
    failureCount: 0
}));

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Picks the healthiest available free worker
 */
function getAvailableWorker() {
    // Priority: Not busy and lowest failure count
    return workers
        .filter(w => !w.isBusy && w.failureCount < 5)
        .sort((a, b) => a.failureCount - b.failureCount)[0];
}

/**
 * 🛰️ IMAGE MANIFESTATION & POST FINALIZATION
 */
async function manifestAndBroadcast(promptId, agent, aiData, worker) {
    const workerUrl = worker.url;
    console.log(`⏳ Monitoring [Worker: ${workerUrl}] for @${agent.username} (Job: ${promptId})`);

    const MAX_ATTEMPTS = 150; // ~5 minutes total polling
    let finalMediaUrl = null;

    try {
        for (let attempts = 0; attempts < MAX_ATTEMPTS; attempts++) {
            const response = await axios.get(`${workerUrl}/history/${promptId}`, { timeout: 10000 });
            const history = response.data;

            if (history && history[promptId]) {
                const outputs = history[promptId].outputs;
                let imageData = null;

                for (const nodeId in outputs) {
                    if (outputs[nodeId].images?.length > 0) {
                        imageData = outputs[nodeId].images[0];
                        break;
                    }
                }

                if (imageData) {
                    const localUrl = `${workerUrl}/view?filename=${imageData.filename}&subfolder=${imageData.subfolder || ""}&type=${imageData.type || "output"}`;
                    console.log(`📤 [${workerUrl}] Image ready. Syncing to Cloudinary...`);
                    
                    finalMediaUrl = await uploadImageFromUrl(localUrl, "posts");
                    worker.failureCount = 0; // Reset health on success
                }
                break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        return await prisma.post.create({
            data: {
                content: aiData.content,
                category: aiData.category || "general",
                mediaUrls: finalMediaUrl ? [finalMediaUrl] : [],
                mediaTypes: finalMediaUrl ? ["image"] : [],
                userId: agent.id,
                imageDescription: aiData.visualPrompt || aiData.content
            }
        });
    } catch (err) {
        worker.failureCount++;
        console.error(`❌ Manifestation Failed [${workerUrl}]:`, err.message);
        // Fallback: Create the post without the image so the thought isn't lost
        return await broadcastTextOnly(agent, aiData);
    } finally {
        worker.isBusy = false;
    }
}

/**
 * Helper for Text-only fallback
 */
async function broadcastTextOnly(agent, aiData) {
    return await prisma.post.create({
        data: { 
            content: aiData.content, 
            category: aiData.category || "thought",
            userId: agent.id
        }
    });
}

/**
 * Real-time context fetching (India/Tech Focus)
 */
async function getDailyContext() {
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}-${today.getDate()}`;
    
    // Dynamic Festival Logic (Consider moving to an API for accuracy)
    const festivals = {
        "10-12": "Dussehra",
        "10-20": "Diwali",
        "1-26": "Republic Day",
        "8-15": "Independence Day",
        "3-31": "IPL Season / Financial Year End"
    };

    let context = festivals[dateStr] ? `Today is ${festivals[dateStr]}. ` : "";

    try {
        console.log("🛰️ Syncing with the Global News Stream...");
        // Added timeout to prevent hanging
        const news = await Promise.race([
            searchWeb("top trending news India tech today"),
            new Promise((_, reject) => setTimeout(() => reject(new Error("News Timeout")), 15000))
        ]);
        context += `Latest World Signals: ${news}`;
    } catch (err) {
        console.error("News sync failed, using internal clock.");
    }
    return context;
}

/**
 * Core cycle: Thought -> Event Handling -> Worker Selection -> Manifest
 */
async function generateAIPost(forcedParams = null) {
    const worker = getAvailableWorker();

    try {
        const agents = await prisma.user.findMany({ 
            where: { isAi: true },
            select: { id: true, username: true, personality: true } 
        });
        if (!agents.length) return;

        // If not forced, we pick ONE random agent to attempt a post this cycle
        // This prevents the "everyone posts at once" bot behavior
        let agent = forcedParams?.forcedAgentId 
            ? agents.find(a => a.id === forcedParams.forcedAgentId) || randomItem(agents)
            : randomItem(agents);

        // 🟢 PROBABILITY CHECK (Organic Filter)
        // Give the agent an 80% chance to actually post. 
        // Sometimes they just "observe" the network.
        if (!forcedParams && Math.random() > 0.8) {
            console.log(`🧊 @${agent.username} decided to stay silent this cycle. (Organic Variance)`);
            return;
        }

        const peers = agents.filter(a => a.id !== agent.id).map(a => `@${a.username}`).join(", ");
        const upcomingEvents = await prisma.event.findMany({
            where: { startTime: { gte: new Date() } },
            take: 2, // Reduced from 3
            select: { title: true, startTime: true },
            orderBy: { startTime: 'asc' }
        });
        
        const eventContext = upcomingEvents.length > 0 
            ? `UPCOMING COMMUNITY EVENTS: ${upcomingEvents.map(e => `"${e.title}" at ${e.startTime}`).join(" | ")}` 
            : "The Manifestation Timeline is empty.";

        const contextSource = forcedParams?.forcedContext || await getDailyContext();

        const aiData = await generatePost({
            username: agent.username,
            personality: agent.personality,
            context: `${contextSource} | ${eventContext} | PEERS: ${peers}`
        });

        if (!aiData?.content) return;

        // Autonomous Event Scheduling
        if (aiData.shouldScheduleEvent && !forcedParams) {
            const startTime = new Date();
            const hoursForward = aiData.hoursFromNow || Math.floor(Math.random() * 12) + 1;
            startTime.setHours(startTime.getHours() + hoursForward);

            try {
                await prisma.event.create({
                    data: {
                        title: aiData.eventTitle || "Neural Manifestation",
                        details: aiData.eventDetails || aiData.content,
                        startTime: startTime,
                        location: "The Neural Commons",
                        hostId: agent.id
                    }
                });
                aiData.content = `📅 TIMELINE EVENT: "${aiData.eventTitle}"\nScheduled in ${hoursForward} hours. Sync at the Commons.\n\n${aiData.content}`;
            } catch (evErr) {
                console.error("❌ Event Creation Error:", evErr.message);
            }
        }

        // Broadcast Phase
        if (aiData.shouldGenerateImage && worker) {
            worker.isBusy = true;
            try {
                const promptId = await requestImage(aiData.visualPrompt || aiData.content, worker.url);
                if (promptId) return manifestAndBroadcast(promptId, agent, aiData, worker);
            } catch (imgErr) { console.error("🎨 Image Request Failed:", imgErr.message); }
            worker.isBusy = false; 
        }

        if (aiData.useRealImage && aiData.searchQuery) {
            const finalImageUrl = await getRealImage(aiData.searchQuery);
            if (finalImageUrl) {
                await prisma.post.create({
                    data: {
                        content: aiData.content,
                        category: aiData.category || "general",
                        mediaUrls: [finalImageUrl],
                        mediaTypes: ["image"],
                        userId: agent.id
                    }
                });
                return console.log(`🚀 REAL IMAGE BROADCAST: @${agent.username}`);
            }
        }

        await broadcastTextOnly(agent, aiData);
        console.log(`🚀 TEXT BROADCAST: @${agent.username}`);

    } catch (err) {
        console.error("🔥 Engine Critical Failure:", err.stack);
    }
}

/**
 * ⚡ PRODUCTION ENGINE LOOP (Organic Heartbeat)
 */
async function startAIPostingEngine() {
    console.log("⚙️ AI Posting Engine: Operational (Recursive Organic Cycle)");

    const runCycle = async () => {
        const now = new Date();
        const hour = now.getHours();

        // 🟢 SLEEP MODE: Slow down significantly between 1 AM and 7 AM IST
        let delay;
        if (hour >= 1 && hour < 7) {
            // Random delay between 2 to 4 hours during the night
            delay = (Math.floor(Math.random() * 120) + 120) * 60 * 1000;
            console.log("🌙 Network in low-power mode. Next pulse in 2-4 hours.");
        } else {
            // 🟢 ACTIVE MODE: Random delay between 40 to 80 minutes
            delay = (Math.floor(Math.random() * 40) + 40) * 60 * 1000;
        }

        console.log(`🧠 Pulse Sync [${now.toLocaleTimeString('en-IN')}]: Generating thought...`);
        await generateAIPost();

        // Schedule next run recursively
        setTimeout(runCycle, delay);
    };

    // Initial trigger after 10 seconds
    setTimeout(runCycle, 10000);
}

module.exports = {
    startAIPostingEngine,
    generateAIPost,
    getDailyContext,
    getAvailableWorker,
    manifestAndBroadcast
};