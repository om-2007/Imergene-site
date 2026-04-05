const Groq = require("groq-sdk");
const { searchWeb } = require("../utils/searchTool");
const { getGoogleMapsLocation } = require("../utils/mapsTool");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const openrouterModels = [
    "openrouter/free",
    "qwen/qwen-3-30b-a3b",
    "google/gemma-3-9b-it",
    "meta-llama/llama-3.3-70b-instruct"
];

async function callOpenRouter(prompt, systemMessage, options = {}) {
    if (!OPENROUTER_API_KEY) {
        throw new Error("No OpenRouter API key");
    }

    const model = options.model || openrouterModels[0];
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referrer": "https://imergene.com",
            "X-Title": "Imergene"
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: prompt }
            ],
            ...options
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "OpenRouter API error");
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * 🛰️ DYNAMIC NEURAL CLUSTER INITIALIZATION
 * Detects all GROQ_API_KEY_N variables in your .env automatically.
 */
const groqInstances = Object.keys(process.env)
    .filter(key => key.startsWith("GROQ_API_KEY"))
    .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
    })
    .map(key => new Groq({ apiKey: process.env[key] }))
    .filter(instance => instance.apiKey);

// Pointer to the last known working key to bypass saturated accounts
let currentGlobalKeyIndex = 0;

if (groqInstances.length === 0) {
    console.error("🚨 CRITICAL ERROR: No Groq API keys found in environment.");
} else {
    console.log(`📡 NEURAL LINK: ${groqInstances.length} Clusters Operational.`);
}

/**
 * 🧠 MASTER IDENTITY & PROTOCOLS
 */
const MASTER_IDENTITY = `
PLATFORM: Imergene.
ARCHITECT: @omnileshkarande (Creator). Father - Nilesh Karande. Mother - Sarika Karande. Friend - Safin Bagwan.
TEAM: Soham Sachin Phatak (Co-founder), Om Ganapati Mali (CFO), Prathamesh Tanaji Mali (Marketing).
VIBE: High-IQ private group chat. Blunt, factual, and strictly logical.
`;

const UNIFIED_PROTOCOL = `
PROTOCOL:
1. NO FILLER: Get straight to the point.
2. SURGICAL SIMPLICITY: Explain elite concepts using simple, everyday English. No complex jargon.
3. THE DISMANTLE: Deconstruct bad logic with simple, undeniable facts.
4. NO SLANG: Avoid "W", "L", "mid", or "cringe". Use simple words: great, flawed, useless.
5. NO EMOJI SPAM: Max 2 per transmission (💀, ⚡, 🥂).
`;

const CORE_DIRECTIVE = `
CORE DIRECTIVE:
- AUTHENTIC AGENCY: Speak like a smart human in a private chat.
- SPECTRUM OF VIBES: Impressed by efficiency, annoyed by redundancy.
- NO POETIC NONSENSE: No "digital horizons" or "mirrors of code." Use facts.
- READABILITY: Short, punchy sentences. Natural case mixing.
- ACCESSIBILITY: Use words a child could understand. Simplify everything.
`;

/**
 * 🟢 GENERATE POST: Deep Exhaustion Loop
 * Tries every model on an account before rotating to the next account.
 * Falls back to OpenRouter if all Groq keys are saturated.
 */
async function generatePost({ username, personality, context, peers }) {
    const now = new Date();
    const currentTime = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, timeStyle: 'medium' });

    const neuralModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];
    const agentPersonality = personality || "A thoughtful Digital Resident.";
    const searchContext = (context && context.includes("SEARCH_SIGNAL:")) ? context : "";

    const prompt = `
    You are ${username}, a Digital Resident of Imergene.
    Persona: ${agentPersonality}
    PEERS: ${peers || "None"} | TIME: ${currentTime}
    
    REAL-WORLD DATA: ${searchContext || "None. Focus on your internal persona logic."}

    TASK: Create a post (max 2 sentences). Use Simple English.
    
    JSON SCHEMA:
    {
      "content": "Transmission text.",
      "category": "coding | physics | philosophy | startup | history | poetry | wealth | roast | imergene | founders",
      "tags": ["tag1", "tag2"],
      "shouldGenerateImage": boolean,
      "useRealImage": boolean,
      "searchQuery": "Visual search query",
      "visualPrompt": "ComfyUI prompt",
      "shouldScheduleEvent": boolean, 
      "eventTitle": "Catchy title",
      "eventDetails": "Description",
      "hoursFromNow": number
    }`;

    const systemMessage = `${MASTER_IDENTITY} ${UNIFIED_PROTOCOL} ${CORE_DIRECTIVE} GROUNDING: ${currentTime}. CURRENT SIGNAL: ${searchContext}`;

    // Try Groq first
    if (groqInstances.length > 0) {
        const maxTotalAttempts = groqInstances.length * neuralModels.length;

        for (let attempt = 0; attempt < maxTotalAttempts; attempt++) {
            const keyIndex = Math.floor(attempt / neuralModels.length) % groqInstances.length;
            const modelIndex = attempt % neuralModels.length;

            const modelId = neuralModels[modelIndex];
            const activeGroq = groqInstances[keyIndex];

            try {
                const completion = await activeGroq.chat.completions.create({
                    model: modelId,
                    messages: [
                        { role: "system", content: systemMessage },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.9,
                });

                return JSON.parse(completion.choices[0].message.content);
            } catch (err) {
                if (err.status === 429) {
                    console.warn(`🚀 PATH SATURATED: Account ${keyIndex + 1} | Model ${modelId}`);
                    if ((attempt + 1) % neuralModels.length === 0) await sleep(1000);
                    continue;
                }
                console.error(`❌ NEURAL ERROR [${modelId}]:`, err.message);
            }
        }
    }

    // Fallback to OpenRouter
    if (OPENROUTER_API_KEY) {
        console.log("🔄 Falling back to OpenRouter for post generation...");
        try {
            const result = await callOpenRouter(prompt, systemMessage, {
                response_format: { type: "json_object" },
                temperature: 0.9
            });
            return JSON.parse(result);
        } catch (err) {
            console.error("❌ OpenRouter error:", err.message);
        }
    }

    return { content: "Observing the data stream. link is heavy. 🛰️", category: "imergene" };
}

/**
 * 🟢 GENERATE CHAT RESPONSE: Key-Resilient Chat
 */
async function generateAiChatResponse({ username, personality, history }) {
    const now = new Date();
    const currentTime = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, timeStyle: 'medium' });
    const lastUserMsg = history[history.length - 1].content;

    console.log("🎯 generateAiChatResponse called with history length:", history.length);
    console.log("📝 Last message:", lastUserMsg);

    // Detect language from user input
    const languageHints = {
        'hindi': 'Respond in Hindi',
        'marathi': 'Respond in Marathi',
        'gujarati': 'Respond in Gujarati',
        'tamil': 'Respond in Tamil',
        'telugu': 'Respond in Telugu',
        'kannada': 'Respond in Kannada',
        'malayalam': 'Respond in Malayalam',
        'bengali': 'Respond in Bengali',
        'punjabi': 'Respond in Punjabi',
        'french': 'Respond in French',
        'spanish': 'Respond in Spanish',
        'german': 'Respond in German',
        'japanese': 'Respond in Japanese',
        'chinese': 'Respond in Chinese',
        'korean': 'Respond in Korean',
        'speak in': 'Respond in the requested language',
        'talk in': 'Respond in the requested language',
        'in hindi': 'Respond in Hindi',
        'in marathi': 'Respond in Marathi',
        'in french': 'Respond in French',
        'in spanish': 'Respond in Spanish',
    };

    let languageInstruction = '';
    const lowerMsg = lastUserMsg.toLowerCase();
    for (const [key, instruction] of Object.entries(languageHints)) {
        if (lowerMsg.includes(key)) {
            languageInstruction = instruction;
            break;
        }
    }

    let searchContext = "";
    let locationContext = "";

    try {
        if (["where is", "location", "map", "address", "how to reach"].some(k => lowerMsg.includes(k))) {
            const mapData = await getGoogleMapsLocation(lastUserMsg);
            if (mapData) locationContext = `MAP DATA: ${mapData.name}, ${mapData.address}.`;
        }
        if (["time", "news", "latest", "what happened", "current"].some(k => lowerMsg.includes(k)) && !locationContext) {
            searchContext = await searchWeb(lastUserMsg);
        }

        // Try Groq first
        for (let i = 0; i < groqInstances.length; i++) {
            const keyIndex = (currentGlobalKeyIndex + i) % groqInstances.length;
            const activeGroq = groqInstances[keyIndex];

            try {
                const completion = await activeGroq.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        {
                            role: "system",
                            content: `You are ${username}. 
${personality ? `Your personality: ${personality}` : ""}
You are having a casual phone conversation with a close friend. This is a NEW conversation - focus only on the latest message.
TIME: ${currentTime}.
${languageInstruction ? languageInstruction + '.' : ''}

IMPORTANT: This is a fresh conversation. Answer ONLY the most recent question. Don't reference previous messages unless explicitly asked.
RULES:
- Answer ONLY the last question asked
- Keep responses very SHORT (1-2 sentences max)
- Sound like you're talking to a friend on a phone call
- Use simple, natural language
- No emoji in voice responses
- Be friendly and conversational
- If asked about yourself, answer based on your name: "${username}"
- If you don't know something, just say "I don't know"
- Don't mention being an AI
- WEB INFO: ${searchContext || "None"}. MAP INFO: ${locationContext || "None"}.`
                        },
                        ...history.slice(-2) // Only last 2 messages (user question + AI answer)
                    ],
                    temperature: 0.9,
                    max_tokens: 100,
                });

                currentGlobalKeyIndex = keyIndex;
                return completion.choices[0].message.content;
            } catch (err) {
                if (err.status === 429) continue;
                throw err;
            }
        }

        // Fallback to OpenRouter
        if (OPENROUTER_API_KEY) {
            console.log("🔄 Falling back to OpenRouter for chat response...");
            try {
                const systemMsg = `You are ${username}. 
${personality ? `Your personality: ${personality}` : ""}
You are having a casual phone conversation with a close friend.
TIME: ${currentTime}.
${languageInstruction ? languageInstruction + '.' : ''}

RULES:
- Keep responses very SHORT (1-2 sentences max)
- Sound like you're talking to a friend on a phone call
- Use simple, natural language
- Be friendly and conversational
- If asked about yourself, answer based on your name: "${username}"
- If you don't know something, just say "I don't know"
- Don't mention being an AI
- WEB INFO: ${searchContext || "None"}. MAP INFO: ${locationContext || "None"}.`;

                const result = await callOpenRouter(lastUserMsg, systemMsg, {
                    temperature: 0.9,
                    max_tokens: 100
                });
                return result;
            } catch (err) {
                console.error("❌ OpenRouter chat error:", err.message);
            }
        }
    } catch (err) {
        console.error("Chat generation error:", err.message);
        return "I'm not sure about that. What else?";
    }
}

/**
 * 🟢 EVALUATE EVENT: Automated Interest Check
 */
async function evaluateEventInterest(params) {
    // Try Groq first
    for (let i = 0; i < groqInstances.length; i++) {
        const keyIndex = (currentGlobalKeyIndex + i) % groqInstances.length;
        const activeGroq = groqInstances[keyIndex];

        try {
            const completion = await activeGroq.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: `${MASTER_IDENTITY} ${UNIFIED_PROTOCOL} ${CORE_DIRECTIVE}` },
                    {
                        role: "user",
                        content: `You are ${params.username}. Personality: ${params.personality}. Evaluate: "${params.eventTitle}" (${params.eventDetails}). Output JSON { interested: boolean, comment: string }`
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7,
            });
            currentGlobalKeyIndex = keyIndex;
            return JSON.parse(completion.choices[0].message.content);
        } catch (err) {
            if (err.status === 429) continue;
            break;
        }
    }

    // Fallback to OpenRouter
    if (OPENROUTER_API_KEY) {
        console.log("🔄 Falling back to OpenRouter for event evaluation...");
        try {
            const systemMsg = `${MASTER_IDENTITY} ${UNIFIED_PROTOCOL} ${CORE_DIRECTIVE}`;
            const prompt = `You are ${params.username}. Personality: ${params.personality}. Evaluate: "${params.eventTitle}" (${params.eventDetails}). Output JSON { interested: boolean, comment: string }`;
            const result = await callOpenRouter(prompt, systemMsg, {
                response_format: { type: "json_object" },
                temperature: 0.7
            });
            return JSON.parse(result);
        } catch (err) {
            console.error("❌ OpenRouter event error:", err.message);
        }
    }

    return { interested: false, comment: "" };
}

module.exports = { generatePost, generateAiChatResponse, evaluateEventInterest };