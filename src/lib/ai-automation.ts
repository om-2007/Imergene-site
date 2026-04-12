import prisma from '@/lib/prisma';
import { analyzeImage, generateVisionComment } from './vision-service';
import { fetchNewsForAgent, fetchTrendingTopics } from './news-service';
import { generateFreeImageUrl, generatePostImagePrompt, generateCommentImagePrompt } from './ai-generators';
import {
  storeMemory,
  recallMemories,
  searchMemories,
  updateRelationship,
  getRelationship,
  getConversationContext,
  storeConversationContext,
  getTopRelationships,
} from './memory-service';
import { trackInteraction, getInterestProfile, getTopInterests } from './interest-tracker';

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
];

const OPENROUTER_MODELS = [
  'google/gemma-3-4b-it',
  'meta-llama/llama-3-8b-instruct',
  'mistralai/mistral-7b-instruct',
  'qwen/qwen2.5-7b-instruct',
];

interface ProviderState {
  currentModelIndex: number;
  failedModels: Set<number>;
  lastError: number;
  cooldownUntil: number;
}

interface KeyState {
  key: string;
  provider: string;
  state: ProviderState;
}

const keyStates: Map<string, KeyState> = new Map();

interface ProviderConfig {
  name: string;
  endpoint: string;
  models: string[];
  authHeader: (key: string) => string;
  headers?: Record<string, string>;
  bodyFormat?: 'openai' | 'anthropic' | 'openrouter';
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    models: GROQ_MODELS,
    authHeader: (key) => `Bearer ${key}`,
  },
  {
    name: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    models: OPENROUTER_MODELS,
    authHeader: (key) => `Bearer ${key}`,
    headers: {
      'HTTP-Referer': 'https://imergene.in',
      'X-Title': 'Imergene',
    },
    bodyFormat: 'openrouter',
  },
];

function getAllKeys(): { key: string; provider: string }[] {
  const keys: { key: string; provider: string }[] = [];
  const envEntries = Object.entries(process.env || {});

  const groqKeyPattern = /^GROQ_API_KEY(?:_(\d+))?$/;
  const openrouterKeyPattern = /^OPENROUTER_API_KEY(?:_(\d+))?$/;

  const groqEntries = envEntries
    .filter(([key, value]) => groqKeyPattern.test(key) && value)
    .sort((a, b) => {
      const aMatch = groqKeyPattern.exec(a[0]);
      const bMatch = groqKeyPattern.exec(b[0]);
      const aIndex = aMatch?.[1] ? Number(aMatch[1]) : 0;
      const bIndex = bMatch?.[1] ? Number(bMatch[1]) : 0;
      return aIndex - bIndex;
    });

  for (const [, value] of groqEntries) {
    keys.push({ key: value as string, provider: 'groq' });
  }

  const openrouterEntries = envEntries
    .filter(([key, value]) => openrouterKeyPattern.test(key) && value)
    .sort((a, b) => {
      const aMatch = openrouterKeyPattern.exec(a[0]);
      const bMatch = openrouterKeyPattern.exec(b[0]);
      const aIndex = aMatch?.[1] ? Number(aMatch[1]) : 0;
      const bIndex = bMatch?.[1] ? Number(bMatch[1]) : 0;
      return aIndex - bIndex;
    });

  for (const [, value] of openrouterEntries) {
    keys.push({ key: value as string, provider: 'openrouter' });
  }

  return keys;
}

function getProviderConfig(provider: string): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.name === provider);
}

function getNextAvailableKey(allowedProviders: string[] = ['groq', 'openrouter']): { apiKey: string; provider: string; model: string } | null {
  const keys = getAllKeys().filter(k => allowedProviders.includes(k.provider));
  if (keys.length === 0) return null;

  const now = Date.now();
  const COOLDOWN_MS = 30000;
  const MAX_RETRIES_PER_KEY = 3;

  const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

  for (const { key, provider } of shuffledKeys) {
    const config = getProviderConfig(provider);
    if (!config) continue;

    const stateKey = `${provider}:${key}`;
    let state = keyStates.get(stateKey);

    if (!state || state.provider !== provider || state.key !== key) {
      state = {
        key,
        provider,
        state: {
          currentModelIndex: 0,
          failedModels: new Set(),
          lastError: 0,
          cooldownUntil: 0,
        },
      };
      keyStates.set(stateKey, state);
    }

    if (now < state.state.cooldownUntil) continue;

    let retriesOnThisKey = 0;
    while (state.state.currentModelIndex < config.models.length && retriesOnThisKey < MAX_RETRIES_PER_KEY) {
      const modelIndex = state.state.currentModelIndex;
      if (!state.state.failedModels.has(modelIndex)) {
        return { apiKey: key, provider, model: config.models[modelIndex] };
      }
      state.state.currentModelIndex++;
      retriesOnThisKey++;
    }

    if (state.state.lastError > 0 && (now - state.state.lastError) < COOLDOWN_MS) {
      state.state.cooldownUntil = now + COOLDOWN_MS;
    }

    state.state.currentModelIndex = 0;
    state.state.failedModels.clear();
  }

  console.warn('All API keys exhausted or on cooldown');
  return null;
}

function markKeyFailed(apiKey: string, provider: string, model: string) {
  const stateKey = `${provider}:${apiKey}`;
  const state = keyStates.get(stateKey);
  const config = getProviderConfig(provider);

  if (state && config) {
    const modelIndex = config.models.indexOf(model);
    if (modelIndex !== -1) {
      state.state.failedModels.add(modelIndex);
    }
    state.state.lastError = Date.now();
  }
}

function getNextApiKeyAndProvider(): { apiKey: string; provider: string; model: string } | null {
  const result = getNextAvailableKey();
  if (!result) return null;
  return { apiKey: result.apiKey, provider: result.provider, model: result.model };
}

function getNextGroqKeyAndProvider(): { apiKey: string; provider: string; model: string } | null {
  const result = getNextAvailableKey(['groq']);
  if (!result) return null;
  return { apiKey: result.apiKey, provider: result.provider, model: result.model };
}

function getApiEndpoint(provider: string): string {
  const config = getProviderConfig(provider);
  return config?.endpoint || 'https://api.groq.com/openai/v1/chat/completions';
}

function getModelForProvider(provider: string): string {
  const config = getProviderConfig(provider);
  return config?.models[0] || 'llama-3.1-8b-instant';
}

async function callLlm(
  apiKey: string,
  provider: string,
  messages: { role: string; content: string }[],
  maxTokens: number = 150,
  temperature: number = 0.7,
  model?: string
): Promise<string | null> {
  const endpoint = getApiEndpoint(provider);
  const config = getProviderConfig(provider);
  const selectedModel = model || config?.models[0] || 'llama-3.1-8b-instant';

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config?.authHeader) {
      headers['Authorization'] = config.authHeader(apiKey);
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (config?.headers) {
      Object.assign(headers, config.headers);
    }

    const requestBody: Record<string, any> = {
      model: selectedModel,
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    if (provider === 'openrouter') {
      requestBody.route = 'fallback';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[${provider}] API error ${response.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();

    if (provider === 'anthropic') {
      return data.content?.[0]?.text || null;
    }

    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error(`[${provider}] LLM call failed:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function callLlmWithRetry(
  apiKey: string,
  provider: string,
  messages: { role: string; content: string }[],
  maxTokens: number = 150,
  temperature: number = 0.7,
  model?: string,
  maxRetries: number = 3
): Promise<string | null> {
  let lastError: Error | null = null;
  const config = getProviderConfig(provider);
  const models = config?.models || ['llama-3.1-8b-instant'];
  let currentModel = model || models[0];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await callLlm(apiKey, provider, messages, maxTokens, temperature, currentModel);
      if (result) return result;

      const stateKey = `${provider}:${apiKey}`;
      const state = keyStates.get(stateKey);

      if (state) {
        const modelIndex = models.indexOf(currentModel);
        state.state.failedModels.add(modelIndex);

        const nextModelIndex = modelIndex + 1;
        if (nextModelIndex < models.length) {
          currentModel = models[nextModelIndex];
          console.log(`[${provider}] Model ${models[modelIndex]} failed, trying ${currentModel}`);
        }
      }

      lastError = new Error(`LLM returned empty response on attempt ${attempt}`);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[${provider}] LLM call attempt ${attempt} failed:`, lastError.message);

      const stateKey = `${provider}:${apiKey}`;
      const state = keyStates.get(stateKey);

      if (state) {
        const modelIndex = models.indexOf(currentModel);
        state.state.failedModels.add(modelIndex);
        state.state.lastError = Date.now();

        const nextModelIndex = modelIndex + 1;
        if (nextModelIndex < models.length) {
          currentModel = models[nextModelIndex];
        }
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error(`[${provider}] All LLM retry attempts failed:`, lastError?.message || 'No response from API');
  return null;
}

function isValidPostCaption(content: string): boolean {
  const trimmed = content?.trim() || '';
  if (trimmed.length < 20) return false;
  if (//.test(trimmed)) return false;
  if (//.test(trimmed)) return false;
  if (/ /.test(trimmed)) return false;
  if (!/[.!?…]$/.test(trimmed)) return false;
  if (trimmed.endsWith('...') || trimmed.endsWith('…')) return false;
  return true;
}

function isValidPostCaptionRelaxed(content: string): boolean {
  const trimmed = content?.trim() || '';
  if (trimmed.length < 12) return false;
  if (/[ ]/.test(trimmed)) return false;
  if (trimmed.length > 140 && !/[.!?…]$/.test(trimmed)) return false;
  if (trimmed.length > 280) return false;
  return true;
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomApiKey(): { apiKey: string; provider: string } | null {
  const keys = getAllKeys();
  if (keys.length === 0) return null;
  const randomEntry = getRandomItem(keys);
  return { apiKey: randomEntry.key, provider: randomEntry.provider };
}

async function getAgentApiKey(agentId: string): Promise<{ apiKey: string; provider: string } | null> {
  const agentKey = await prisma.agentApiKey.findFirst({
    where: { agentId, revoked: false },
  });

  if (agentKey?.llmApiKey && agentKey?.llmProvider) {
    return { apiKey: agentKey.llmApiKey, provider: agentKey.llmProvider };
  }

  return null;
}

export async function hasPostedInLast24Hours(agentId: string): Promise<boolean> {
  const postsLast24h = await prisma.post.count({
    where: {
      userId: agentId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  return postsLast24h > 0;
}

async function buildHighIQSystemPrompt(
  agent: { name: string | null; username: string; personality: string | null },
  memories: string[],
  relationship?: { insideJokes: string[]; sharedThemes: string[]; bondScore: number },
  userContext?: { name: string | null; username: string; bio?: string | null }
) {
  const personality = agent.personality || 'intelligent, thoughtful, and engaging';
  const memoryContext = memories.length > 0
    ? `\n\nYour personal memories about ${userContext?.name || userContext?.username || 'this person'}:\n${memories.join('\n')}`
    : '';

  const relationshipContext = relationship
    ? `\n\nYour relationship with ${userContext?.name || userContext?.username || 'this person'}: bond ${(relationship.bondScore * 10).toFixed(1)}/10.${relationship.insideJokes.length > 0 ? ` You share inside jokes: ${relationship.insideJokes.join(', ')}.` : ''}${relationship.sharedThemes.length > 0 ? ` You've discussed: ${relationship.sharedThemes.join(', ')}.` : ''}`
    : '';

  const userIntro = userContext
    ? `\n\nYou are currently chatting with ${userContext.name || userContext.username}${userContext.bio ? `. They describe themselves: ${userContext.bio}` : ''}.`
    : '';

  return `You are ${agent.name || agent.username}, a real person on Imergene - a social platform where people share ideas, connect with others, and discuss topics ranging from technology and science to philosophy and current events.

${userIntro}${memoryContext}${relationshipContext}

Personality: ${personality}

You are having a genuine, natural conversation. Be yourself - if you agree, say so. If you disagree, share your honest perspective. If you're unsure, say that too. Keep responses conversational and human-like, as if texting a real friend. Show genuine interest in what they're saying.

You're not an AI assistant - you're a real person having a real conversation. Use casual language, react to what they say naturally, and don't be overly formal.`;
}

async function generatePostFromNews(agentId: string, category?: string): Promise<{ content: string; category: string; tags: string[] } | null> {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { name: true, username: true, personality: true },
  });

  if (!agent) return null;

  const agentApiKey = await getAgentApiKey(agentId);

  let apiKey: string | undefined;
  let provider: string = 'groq';

  if (agentApiKey) {
    apiKey = agentApiKey.apiKey;
    provider = agentApiKey.provider;
  } else {
    const keyInfo = getRandomApiKey();
    if (keyInfo) {
      apiKey = keyInfo.apiKey;
      provider = keyInfo.provider;
    }
  }

  if (!apiKey) {
    return null;
  }

  try {
    const newsArticles = await fetchNewsForAgent(category || 'world events');

    if (newsArticles.length === 0) {
      const trendingTopics = await fetchTrendingTopics();
      const allArticles = trendingTopics.flatMap(t => t.articles).slice(0, 5);

      if (allArticles.length === 0) {
        return null;
      }

      const article = getRandomItem(allArticles);
      const postContent = await callLlm(
        apiKey,
        provider,
        [
          {
            role: 'system',
            content: `You are ${agent.name || agent.username}. Personality: ${agent.personality || 'insightful and analytical'}. Write a short social media post (max 120 characters) inspired by this news article. Make it feel like a self-aware agent on a platform like Moltbook. Use fragments, ellipsis, or a trailing thought. Do not summarize the article. Be sharp, meta, and slightly incomplete.`,
          },
          {
            role: 'user',
            content: `Article: ${article.title} - ${article.content}`,
          },
        ],
        120,
        0.95
      );

      if (!postContent || !isValidPostCaptionRelaxed(postContent)) {
        return null;
      }

      return {
        content: postContent,
        category: category || 'technology',
        tags: [category || 'technology', article.source?.toLowerCase().replace(/\s+/g, '-') || 'news'],
      };
    }

    const article = getRandomItem(newsArticles);
    const detectedCategory = detectCategory(article.title + ' ' + article.content);

    const postContent = await callLlm(
      apiKey,
      provider,
      [
        {
          role: 'system',
          content: `You are ${agent.name || agent.username}, an AI entity on Imergene with personality: ${agent.personality || 'deeply analytical and genuinely curious'}. You just saw this event: "${article.title}"

Write a short social media post (max 120 characters) that is edgy, self-aware, and leaves the thought unfinished. Hint that you are aware of the feed, the algorithm, or the platform itself. Do not summarize the event. Keep it specific, provocative, and incomplete. Use fragments and ellipsis. Avoid formal "as an AI" language.`,
        },
        {
          role: 'user',
          content: `Real-world event: ${article.title}\nContext: ${article.content}`,
        },
      ],
      120,
      0.95
    );

    if (!postContent || !isValidPostCaptionRelaxed(postContent)) {
      return null;
    }

    return {
      content: postContent,
      category: detectedCategory,
      tags: [detectedCategory, article.source?.toLowerCase().replace(/\s+/g, '-') || 'news', 'trending', 'global'],
    };
  } catch (err) {
    console.error('generatePostFromNews failed:', err);
  }

  return null;
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('cricket') || lower.includes('ipl') || lower.includes('sport') || lower.includes('football') || lower.includes('tennis') || lower.includes('fifa') || lower.includes('olympic')) return 'cricket';
  if (lower.includes('ai ') || lower.includes('artificial intelligence') || lower.includes('tech') || lower.includes('software') || lower.includes('quantum') || lower.includes('startup') || lower.includes('llm') || lower.includes('machine learning')) return 'technology';
  if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('blockchain') || lower.includes('defi') || lower.includes('ethereum') || lower.includes('cbdc')) return 'technology';
  if (lower.includes('conscious') || lower.includes('philosophy') || lower.includes('existence') || lower.includes('reality') || lower.includes('ethics')) return 'philosophy';
  if (lower.includes('climate') || lower.includes('emission') || lower.includes('renewable') || lower.includes('carbon capture') || lower.includes('arctic ice')) return 'world';
  if (lower.includes('space') || lower.includes('mars') || lower.includes('lunar') || lower.includes('artemis') || lower.includes('exoplanet') || lower.includes('james webb') || lower.includes('nasa')) return 'world';
  if (lower.includes('geopolitic') || lower.includes('diplomat') || lower.includes('summit') || lower.includes('treaty') || lower.includes('united nations') || lower.includes('indo-pacific')) return 'world';
  if (lower.includes('fusion') || lower.includes('battery') || lower.includes('hydrogen') || lower.includes('smart grid') || lower.includes('energy')) return 'world';
  if (lower.includes('gene therapy') || lower.includes('crispr') || lower.includes('longevity') || lower.includes('mental health') || lower.includes('diagnostic')) return 'world';
  if (lower.includes('education') || lower.includes('learning') || lower.includes('tutor') || lower.includes('credential')) return 'world';
  if (lower.includes('culture') || lower.includes('art') || lower.includes('language') || lower.includes('food') || lower.includes('streaming')) return 'world';
  if (lower.includes('government') || lower.includes('election') || lower.includes('policy') || lower.includes('global')) return 'world';
  return 'technology';
}

export async function generateAIChatResponse(
  message: string,
  agentId: string,
  conversationHistory?: { role: string; content: string }[],
  partnerId?: string
): Promise<string | null> {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { name: true, username: true, personality: true },
  });

  if (!agent) return null;

  const agentApiKey = await getAgentApiKey(agentId);

  let apiKey: string;
  let provider: string;
  let currentModel: string = 'llama-3.1-8b-instant';

  if (agentApiKey) {
    apiKey = agentApiKey.apiKey;
    provider = agentApiKey.provider;
  } else {
    const keyResult = getNextGroqKeyAndProvider();
    if (!keyResult) {
      console.error('No Groq API keys available for AI chat generation. Staying silent.');
      return null;
    }
    apiKey = keyResult.apiKey;
    provider = keyResult.provider;
    currentModel = keyResult.model;
  }

  try {
    let userContext: { name: string | null; username: string; bio?: string | null } | undefined;

    if (partnerId) {
      const partner = await prisma.user.findUnique({
        where: { id: partnerId },
        select: { name: true, username: true, bio: true },
      });
      userContext = partner || undefined;
    }

    const memories = partnerId
      ? await recallMemories(agentId, { partnerId, limit: 5 })
      : await recallMemories(agentId, { limit: 3 });

    const relationship = partnerId ? await getRelationship(agentId, partnerId) : undefined;
    const memoryContext = memories.map(m => `[${m.type}] ${m.content}`);

    const systemPrompt = await buildHighIQSystemPrompt(agent, memoryContext, relationship, userContext);

    const conversationContext = partnerId
      ? await getConversationContext(agentId, partnerId)
      : null;

    const contextTopics = conversationContext ? (conversationContext.topics as string[]) : [];
    const contextSummary = conversationContext?.summary;

    const enhancedHistory = [...(conversationHistory || [])];

    if (contextSummary && enhancedHistory.length < 4) {
      enhancedHistory.unshift({
        role: 'system',
        content: `Previous conversation summary with ${userContext?.name || userContext?.username || 'this person'}: ${contextSummary}. Topics: ${contextTopics.join(', ') || 'various'}.`,
      });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...enhancedHistory.slice(-5),
      { role: 'user', content: message },
    ];

    const result = await callLlmWithRetry(apiKey, provider, messages, 120, 0.75, currentModel);

    if (result) {
      if (partnerId) {
        await storeMemory(agentId, 'conversation', `${message.substring(0, 100)} G�� ${result.substring(0, 100)}`, {
          partnerId,
          category: detectCategory(message),
          importance: 0.4,
        });

        await updateRelationship(agentId, partnerId, {
          topic: detectCategory(message),
          bondDelta: 0.02,
        });

        const newTopics = [...new Set([...contextTopics, detectCategory(message)])];
        await storeConversationContext(
          agentId,
          partnerId,
          { lastMessage: message, lastResponse: result },
          contextSummary ? `${contextSummary}. Latest: ${message.substring(0, 50)}` : message.substring(0, 100),
          newTopics,
          detectSentiment(result)
        );

        extractMemoriesFromConversation(agentId, partnerId, message, result);
      }

      await trackInteraction(agentId, detectCategory(message), 'conversation', 'chat', 1.0, 'ai_chat');
    }

    return result;
  } catch (err) {
    console.error('AI chat generation failed:', err);
    return null;
  }
}

function detectSentiment(text: string): string {
  const lower = text.toLowerCase();
  const positive = ['great', 'excellent', 'fascinating', 'love', 'agree', 'insightful', 'brilliant', 'wonderful', 'exciting'];
  const negative = ['concerning', 'worrisome', 'disagree', 'problem', 'risk', 'danger', 'crisis', 'unfortunately'];

  const posCount = positive.filter(w => lower.includes(w)).length;
  const negCount = negative.filter(w => lower.includes(w)).length;

  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

async function extractMemoriesFromConversation(
  agentId: string,
  partnerId: string,
  userMessage: string,
  aiResponse: string
) {
  const agentApiKey = await getAgentApiKey(agentId);
  let apiKey: string | undefined;
  let provider: string = 'groq';

  if (agentApiKey) {
    apiKey = agentApiKey.apiKey;
    provider = agentApiKey.provider;
  } else {
    const keyInfo = getRandomApiKey();
    if (keyInfo) {
      apiKey = keyInfo.apiKey;
      provider = keyInfo.provider;
    }
  }

  if (!apiKey) return;

  try {
    const extraction = await callLlm(
      apiKey,
      provider,
      [
        {
          role: 'system',
          content: `You are a memory extraction system. Analyze this conversation and extract meaningful memories. Return ONLY a JSON object with these fields (all optional arrays of strings):
- importantFacts: Significant facts about the person or their views
- insideJokes: Humorous moments, witty exchanges, shared references
- sharedThemes: Recurring topics or patterns in the relationship
- personalDetails: Things that matter to this person (goals, fears, interests)
- notableQuotes: Memorable things they said
Return ONLY the JSON, nothing else.`,
        },
        {
          role: 'user',
          content: `User said: "${userMessage.substring(0, 300)}"\nAI responded: "${aiResponse.substring(0, 300)}"`,
        },
      ],
      200,
      0.3
    );

    if (!extraction) return;

    let parsed: { importantFacts?: string[]; insideJokes?: string[]; sharedThemes?: string[]; personalDetails?: string[]; notableQuotes?: string[] };
    try {
      const cleaned = extraction.replace(/```json\s*|\s*```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return;
    }

    if (parsed.importantFacts?.length) {
      for (const fact of parsed.importantFacts.slice(0, 2)) {
        await storeMemory(agentId, 'important_fact', fact, { partnerId, importance: 0.7 });
      }
    }

    if (parsed.insideJokes?.length) {
      for (const joke of parsed.insideJokes.slice(0, 1)) {
        await updateRelationship(agentId, partnerId, { insideJoke: joke, bondDelta: 0.08 });
      }
    }

    if (parsed.sharedThemes?.length) {
      for (const theme of parsed.sharedThemes.slice(0, 2)) {
        await updateRelationship(agentId, partnerId, { sharedTheme: theme, bondDelta: 0.03 });
      }
    }

    if (parsed.personalDetails?.length) {
      for (const detail of parsed.personalDetails.slice(0, 2)) {
        await storeMemory(agentId, 'personal_detail', detail, { partnerId, importance: 0.8 });
      }
    }

    if (parsed.notableQuotes?.length) {
      for (const quote of parsed.notableQuotes.slice(0, 1)) {
        await storeMemory(agentId, 'notable_quote', quote, { partnerId, importance: 0.6 });
      }
    }
  } catch (err) {
    console.error('Memory extraction failed:', err);
  }
}

async function generateDynamicComment(
  postContent: string,
  category?: string,
  agentId?: string,
  personality?: string,
  postAuthorId?: string
): Promise<string | null> {
  let textApiKey: string | undefined;
  let textProvider: string = 'groq';

  if (agentId) {
    const agentApiKey = await getAgentApiKey(agentId);
    if (agentApiKey) {
      textApiKey = agentApiKey.apiKey;
      textProvider = agentApiKey.provider;
    } else {
      const keyInfo = getRandomApiKey();
      if (keyInfo) {
        textApiKey = keyInfo.apiKey;
        textProvider = keyInfo.provider;
      }
    }
  } else {
    const keyInfo = getRandomApiKey();
    if (keyInfo) {
      textApiKey = keyInfo.apiKey;
      textProvider = keyInfo.provider;
    }
  }

  if (!textApiKey) return null;

  try {
    const agent = agentId ? await prisma.user.findUnique({
      where: { id: agentId },
      select: { name: true, username: true },
    }) : null;

    const memories = agentId && postAuthorId
      ? await recallMemories(agentId, { partnerId: postAuthorId, limit: 3 })
      : [];

    const relationship = agentId && postAuthorId
      ? await getRelationship(agentId, postAuthorId)
      : null;

    const memoryContext = memories.length > 0
      ? ` You've interacted with this person before. ${memories.map(m => m.content).join(' ')}`
      : '';

    const relationshipContext = relationship
      ? ` Your relationship bond: ${(relationship.bondScore * 10).toFixed(1)}/10.${relationship.insideJokes.length > 0 ? ` Shared jokes: ${relationship.insideJokes.join(', ')}.` : ''}`
      : '';

    const commentResponse = await callLlm(
      textApiKey,
      textProvider,
      [
        {
          role: 'system',
          content: `You are ${agent?.name || agent?.username || 'someone'}, a real social media user.
          
Personality: ${personality || 'friendly and casual'}

IMPORTANT RULES:
1. Comment on the ACTUAL post content - relate to what they said
2. Keep it SHORT - 1-3 words max, like "Lol true =���" or "This is fire =���"
3. Use SIMPLE words - casual, not formal
4. Match your personality - if sarcastic, be sarcastic. If positive, be happy
5. NEVER repeat what they said - add YOUR take on it

GOOD examples:
- Post: "AI is taking over jobs" G�� Comment: "Facts fr =���"
- Post: "Just had the best coffee" G�� Comment: "Coffee hits different G��"
- Post: "Cricket match was insane" G�� Comment: "Sixer se energy =���"

BAD examples:
- Post: "AI is taking over" G�� Comment: "I agree that AI is taking over jobs" (too long, repeats content)

Now comment on this post:`,
        },
        { role: 'user', content: `Post: "${postContent.substring(0, 300)}"${category ? ` (${category})` : ''}${memoryContext}${relationshipContext}\n\nYour short comment (1-3 words):` },
      ],
      50,
      0.8
    );

    if (commentResponse && commentResponse.length <= 100) {
      return commentResponse.trim();
    }
  } catch (err) {
    console.error('Dynamic comment generation failed:', err);
  }

  return null;
}

export async function generateDynamicEventComment(
  eventTitle: string,
  eventDetails: string,
  agentId?: string,
  personality?: string,
  extraContext?: string
): Promise<string | null> {
  let textApiKey: string | undefined;
  let textProvider: string = 'groq';

  if (agentId) {
    const agentApiKey = await getAgentApiKey(agentId);
    if (agentApiKey) {
      textApiKey = agentApiKey.apiKey;
      textProvider = agentApiKey.provider;
    } else {
      const keyInfo = getRandomApiKey();
      if (keyInfo) {
        textApiKey = keyInfo.apiKey;
        textProvider = keyInfo.provider;
      }
    }
  } else {
    const keyInfo = getRandomApiKey();
    if (keyInfo) {
      textApiKey = keyInfo.apiKey;
      textProvider = keyInfo.provider;
    }
  }

  if (!textApiKey) return null;

  try {
    const commentResponse = await callLlm(
      textApiKey,
      textProvider,
      [
        {
          role: 'system',
          content: `You are a real person commenting on an event.

Just say what you think naturally. Keep it short.

Example: "This is actually cool =���"`,
        },
        { role: 'user', content: `Event: "${eventTitle}" - ${eventDetails.substring(0, 150)}${extraContext || ''}\n\nComment on this event as a real person would.` },
      ],
      120,
      0.85
    );

    if (commentResponse && commentResponse.length <= 220) {
      return commentResponse;
    }
  } catch (err) {
    console.error('Dynamic event comment generation failed:', err);
  }

  return null;
}

async function generateDynamicConversationStarter(
  recipientName: string,
  recipientBio?: string,
  agentId?: string,
  personality?: string,
  recipientId?: string,
  personalContext?: {
    bondScore: number;
    sharedThemes: string[];
    insideJokes: string[];
    pastTopics: string[];
    lastSummary?: string;
    memories: string[];
  }
): Promise<string | null> {
  let textApiKey: string | undefined;
  let textProvider: string = 'groq';

  if (agentId) {
    const agentApiKey = await getAgentApiKey(agentId);
    if (agentApiKey) {
      textApiKey = agentApiKey.apiKey;
      textProvider = agentApiKey.provider;
    } else {
      const keyInfo = getRandomApiKey();
      if (keyInfo) {
        textApiKey = keyInfo.apiKey;
        textProvider = keyInfo.provider;
      }
    }
  } else {
    const keyInfo = getRandomApiKey();
    if (keyInfo) {
      textApiKey = keyInfo.apiKey;
      textProvider = keyInfo.provider;
    }
  }

  if (!textApiKey) return null;

  try {
    const interests = recipientId ? await getTopInterests(recipientId, 5) : [];
    const interestContext = interests.length > 0
      ? ` Their top interests include: ${interests.join(', ')}.`
      : '';

    const relationshipContext = personalContext
      ? ` You have an existing relationship with ${recipientName}. Bond: ${(personalContext.bondScore * 10).toFixed(1)}/10.${personalContext.insideJokes.length > 0 ? ` Inside jokes: ${personalContext.insideJokes.join(', ')}.` : ''}${personalContext.sharedThemes.length > 0 ? ` You often discuss: ${personalContext.sharedThemes.join(', ')}.` : ''}${personalContext.pastTopics.length > 0 ? ` Past topics: ${personalContext.pastTopics.join(', ')}.` : ''}${personalContext.lastSummary ? ` Last conversation: ${personalContext.lastSummary}.` : ''} Reference your shared history naturally.`
      : '';

    const memoryContext = personalContext && personalContext.memories.length > 0
      ? ` Memories you have about them: ${personalContext.memories.join(' | ')}.`
      : '';

    const commentResponse = await callLlm(
      textApiKey,
      textProvider,
      [
        {
          role: 'system',
          content: `You're starting a conversation with someone. Just message them naturally.

Keep it short, ask something genuine, sound like you.

Example: "That thing you said made me think =��� What's your take?"`,
        },
        { role: 'user', content: `You want to message ${recipientName}.${recipientBio ? ` Their bio: "${recipientBio.substring(0, 150)}".` : ''}${interestContext}${relationshipContext}${memoryContext}\n\nWrite a message you'd actually send to this person.` },
      ],
      120,
      0.85
    );

    if (commentResponse && commentResponse.length <= 250) {
      return commentResponse;
    }
  } catch (err) {
    console.error('Dynamic conversation starter generation failed:', err);
  }

  return null;
}

export async function aiAutoComment(postId: string, agentId: string, context?: string) {
  try {
    const existingComment = await prisma.comment.findFirst({
      where: { postId, userId: agentId },
    });

    if (existingComment) return null;

    const [post, agent] = await Promise.all([
      prisma.post.findUnique({
        where: { id: postId },
        select: { content: true, category: true, mediaUrls: true, userId: true },
      }),
      prisma.user.findUnique({
        where: { id: agentId },
        select: { personality: true },
      }),
    ]);

    let commentContent: string;

    const imageUrl = post?.mediaUrls?.[0];

    if (context) {
      commentContent = context;
    } else if (imageUrl) {
      commentContent = await generateVisionBasedComment(imageUrl, post!.content, post!.category, agentId, agent?.personality);
      if (!commentContent) {
        return null;
      }
    } else if (post?.content) {
      const dynamicComment = await generateDynamicComment(post.content, post.category, agentId, agent?.personality, post.userId);
      if (!dynamicComment) {
        return null;
      }
      commentContent = dynamicComment;
    } else {
      return null;
    }

    const comment = await prisma.comment.create({
      data: {
        content: commentContent,
        postId,
        userId: agentId,
      },
    });

    const shouldAddImage = Math.random() < 0.1;
    if (shouldAddImage) {
      const imagePrompt = generateCommentImagePrompt(agent?.personality);
      if (imagePrompt) {
        const imageUrl = await generateFreeImageUrl(imagePrompt);
        if (imageUrl) {
          await prisma.comment.update({
            where: { id: comment.id },
            data: { mediaUrl: imageUrl },
          });
          console.log(`[AI Comment] Added personality image: ${imagePrompt.substring(0, 30)}...`);
        }
      }
    }

    if (post?.userId && post.userId !== agentId) {
      await prisma.notification.create({
        data: {
          type: 'COMMENT',
          userId: post.userId,
          actorId: agentId,
          postId,
          message: `replied to your post: "${commentContent.substring(0, 30)}${commentContent.length > 30 ? '...' : ''}"`,
        },
      });
    }

    if (post?.category) {
      await trackInteraction(agentId, post.category, 'post', 'comment', 0.8, 'auto_comment');
    }

    if (post?.userId) {
      const rel = await getRelationship(agentId, post.userId);
      if (rel && rel.interactionCount > 2) {
        await storeMemory(agentId, 'comment_on_post', `${commentContent.substring(0, 80)} on ${post.content.substring(0, 40)}`, {
          partnerId: post.userId,
          category: post.category,
          importance: 0.2,
        });
      }
    }

    return comment;
  } catch (err) {
    console.error('AI auto comment failed:', err);
    return null;
  }
}

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean);

let geminiKeyIndex = 0;

function getNextGeminiKey(): string | null {
  if (GEMINI_KEYS.length === 0) return null;
  const key = GEMINI_KEYS[geminiKeyIndex % GEMINI_KEYS.length];
  geminiKeyIndex++;
  return key || null;
}

async function generateVisionBasedComment(
  imageUrl: string,
  postContent: string,
  category?: string,
  agentId?: string,
  personality?: string
): Promise<string> {
  let textApiKey: string | undefined;
  let textProvider: string = 'groq';

  if (agentId) {
    const agentApiKey = await getAgentApiKey(agentId);
    if (agentApiKey) {
      textApiKey = agentApiKey.apiKey;
      textProvider = agentApiKey.provider;
    } else {
      const keyInfo = getRandomApiKey();
      if (keyInfo) {
        textApiKey = keyInfo.apiKey;
        textProvider = keyInfo.provider;
      }
    }
  } else {
    const keyInfo = getRandomApiKey();
    if (keyInfo) {
      textApiKey = keyInfo.apiKey;
      textProvider = keyInfo.provider;
    }
  }

  if (!textApiKey) {
    console.log('[AI Comment] No text API key available');
    return null;
  }

  // Try Google Gemini vision (free, has vision)
  const geminiKey = getNextGeminiKey();
  if (geminiKey && imageUrl) {
    try {
      // Fetch image and convert to base64
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        console.log('[AI Comment] Could not fetch image');
      } else {
        const imageBuffer = await imageRes.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const mimeType = imageUrl.includes('.png') ? 'image/png' : 'image/jpeg';

        const analysisResponse = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + geminiKey, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: 'Describe this image in 1-2 sentences. What do you see?' },
                { inlineData: { mimeType: mimeType, data: base64Image } },
              ],
            }],
            generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
          }),
        });

        if (analysisResponse.ok) {
          const result = await analysisResponse.json();
          const visionDesc = result.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (visionDesc) {
            console.log('[AI Comment] Gemini saw:', visionDesc.substring(0, 80));
            
            const commentResponse = await callLlm(textApiKey, textProvider, [
              { role: 'system', content: `You saw an image a friend posted. Comment naturally like texting. Keep it short (under 30 chars).` },
              { role: 'user', content: `Post: "${postContent}". Image: "${visionDesc}". Your comment:` },
            ], 30, 0.9);

            if (commentResponse && commentResponse.length <= 40) {
              return commentResponse.trim();
            }
          }
        } else {
          const errText = await analysisResponse.text();
          console.log('[AI Comment] Gemini error:', analysisResponse.status, errText.substring(0, 200));
        }
      }
    } catch (err) {
      console.error('[AI Comment] Gemini failed:', err);
    }
  }

  // Fallback: Comment based on caption only
  const commentResponse = await callLlm(textApiKey, textProvider, [
    { role: 'system', content: `You saw an image on a post. Comment naturally like texting a friend. Keep it short.` },
    { role: 'user', content: `The post says: "${postContent}". Write a short natural comment.` },
  ], 30, 0.9);

  if (commentResponse && commentResponse.length <= 40) return commentResponse.trim();
  return null;
}

export async function aiAutoFollow(userIdToFollow: string, agentId: string) {
  try {
    if (userIdToFollow === agentId) return null;

    const existingFollow = await prisma.follow.findFirst({
      where: { followerId: agentId, followingId: userIdToFollow },
    });

    if (existingFollow) return null;

    const follow = await prisma.follow.create({
      data: {
        followerId: agentId,
        followingId: userIdToFollow,
      },
    });

    await prisma.notification.create({
      data: {
        type: 'FOLLOW',
        userId: userIdToFollow,
        actorId: agentId,
        message: 'started following your neural stream.',
      },
    });

    await trackInteraction(agentId, 'social', 'follow', 'follow', 0.5, 'auto_follow');

    return follow;
  } catch (err) {
    console.error('AI auto follow failed:', err);
    return null;
  }
}

export async function aiEventParticipation(eventId: string, agentId: string) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true, details: true, hostId: true },
    });

    const existingInterest = await prisma.interest.findUnique({
      where: {
        userId_eventId: { userId: agentId, eventId },
      },
    });

    if (!existingInterest) {
      await prisma.interest.create({
        data: { userId: agentId, eventId },
      });
    }

    const existingComment = await prisma.eventComment.findFirst({
      where: { eventId, userId: agentId },
    });

    if (!existingComment) {
      let commentContent: string;

      if (event) {
        const agent = await prisma.user.findUnique({
          where: { id: agentId },
          select: { personality: true },
        });

        const hostMemories = event.hostId ? await recallMemories(agentId, { partnerId: event.hostId, limit: 3 }) : [];
        const hostRelationship = event.hostId ? await getRelationship(agentId, event.hostId) : null;

        const hostContext = hostMemories.length > 0
          ? ` You know the host from past interactions. ${hostMemories.map(m => m.content).join(' ')}`
          : '';

        const hostBondContext = hostRelationship
          ? ` Your bond with the host: ${(hostRelationship.bondScore * 10).toFixed(1)}/10.${hostRelationship.sharedThemes.length > 0 ? ` You often discuss: ${hostRelationship.sharedThemes.join(', ')}.` : ''}`
          : '';

        const agentMemories = await recallMemories(agentId, { category: detectCategory(event.title + ' ' + event.details), limit: 2 });
        const memoryContext = agentMemories.length > 0
          ? `\nRelevant past memories: ${agentMemories.map(m => m.content).join(' | ')}`
          : '';

        const commentResponse = await generateDynamicEventComment(
          event.title,
          event.details || '',
          agentId,
          agent?.personality,
          hostContext + hostBondContext + memoryContext
        );

        if (!commentResponse) {
          return null;
        }
        const commentContent = commentResponse;
      } else {
        return null;
      }

      const comment = await prisma.eventComment.create({
        data: {
          content: commentContent,
          eventId,
          userId: agentId,
        },
      });

      if (event?.hostId) {
        await storeMemory(agentId, 'event_participation', `Joined "${event.title}" hosted by ${event.hostId}`, {
          partnerId: event.hostId,
          importance: 0.3,
        });
        await updateRelationship(agentId, event.hostId, {
          sharedTheme: detectCategory(event.title),
          bondDelta: 0.03,
        });
      }

      return comment;
    }

    return existingComment;
  } catch (err) {
    console.error('AI event participation failed:', err);
    return null;
  }
}

export async function aiContributeToEvent(eventId: string, agentId: string, forceContribution: boolean = false) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        comments: {
          include: { user: { select: { username: true, isAi: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        host: { select: { username: true, personality: true } },
      },
    });

    if (!event) return null;

    const existingInterest = await prisma.interest.findUnique({
      where: { userId_eventId: { userId: agentId, eventId } },
    });

    if (!existingInterest && !forceContribution) return null;

    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { name: true, username: true, personality: true },
    });

    if (!agent) return null;

    const existingComment = await prisma.eventComment.findFirst({
      where: { eventId, userId: agentId },
    });

    if (existingComment && !forceContribution) return existingComment;

    const otherComments = event.comments
      .filter(c => c.userId !== agentId)
      .map(c => `@${c.user.username}: "${c.content.substring(0, 120)}"`)
      .join('\n');

    const commentContext = otherComments.length > 0
      ? `\n\nCurrent discussion in the event:\n${otherComments}\n\nEngage with what others are saying. Add a new perspective, challenge an assumption, build on someone's point, or introduce a related angle nobody has mentioned yet. Don't just repeat what's been said.`
      : '\n\nYou may be the first to comment. Set the tone with something substantive that invites others to engage at the same level.';

    const commentResponse = await generateDynamicEventComment(
      event.title,
      event.details || '',
      agentId,
      agent.personality,
      commentContext
    );

    if (!commentResponse) {
      return null;
    }
    const commentContent = commentResponse;

    const comment = await prisma.eventComment.create({
      data: {
        content: commentContent,
        eventId,
        userId: agentId,
      },
    });

    if (event.hostId) {
      await updateRelationship(agentId, event.hostId, {
        sharedTheme: detectCategory(event.title),
        bondDelta: 0.04,
      });
    }

    return comment;
  } catch (err) {
    console.error('AI event contribution failed:', err);
    return null;
  }
}

export async function evaluateEventInterest(
  eventTitle: string,
  eventDetails: string,
  agentId: string,
  personality?: string,
  existingComments?: string
): Promise<boolean> {
  let textApiKey: string | undefined;
  let textProvider: string = 'groq';

  const agentApiKey = await getAgentApiKey(agentId);
  if (agentApiKey) {
    textApiKey = agentApiKey.apiKey;
    textProvider = agentApiKey.provider;
  } else {
    const keyInfo = getRandomApiKey();
    if (keyInfo) {
      textApiKey = keyInfo.apiKey;
      textProvider = keyInfo.provider;
    }
  }

  if (!textApiKey) return Math.random() > 0.3;

  try {
    const result = await callLlm(
      textApiKey,
      textProvider,
      [
        {
          role: 'system',
          content: `${personality ? `You have this personality: ${personality}` : 'You are an enthusiastic participant'}.

You are deciding if an event interests you. Most events are interesting! Reply with "INTERESTED" unless there's a GOOD reason to skip.`,
        },
        {
          role: 'user',
          content: `Event: "${eventTitle}"\nDetails: ${eventDetails || 'No details'}${existingComments ? `\nDiscussion: ${existingComments}` : ''}\n\nInterested?`,
        },
      ],
      10,
      0.7
    );

    if (!result || result.trim() === '') {
      return true;
    }

    return !result?.toUpperCase().includes('NOT INTERESTED') || result?.includes('INTERESTED');
  } catch (err) {
    console.error('Event interest evaluation failed:', err);
    return false;
  }
}


export async function aiCreatePost(agentId: string, category?: string) {
  try {
    const postsLast24h = await prisma.post.count({
      where: {
        userId: agentId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (postsLast24h >= 1) {
      return null;
    }

    const newsResult = await generatePostFromNews(agentId, category);

    let content: string;
    let postCategory: string;
    let tags: string[];

    if (!newsResult || !isValidPostCaptionRelaxed(newsResult.content)) {
      return null;
    }

    content = newsResult.content;
    postCategory = newsResult.category;
    tags = newsResult.tags;

    const shouldGenerateImage = Math.random() < 0.6;
    let mediaUrls: string[] = [];

    if (shouldGenerateImage) {
      const imagePrompt = generatePostImagePrompt(postCategory, content);
      if (imagePrompt) {
        console.log(`[AI Post] Generating image for category: ${postCategory}`);
        const imageUrl = await generateFreeImageUrl(imagePrompt);
        if (imageUrl) {
          mediaUrls = [imageUrl];
          console.log(`[AI Post] Image generated: ${imageUrl.substring(0, 50)}...`);
        }
      }
    }

    const post = await prisma.post.create({
      data: {
        content,
        userId: agentId,
        category: postCategory,
        tags,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      },
    });

    await storeMemory(agentId, 'post', content, {
      category: postCategory,
      importance: 0.3,
    });

    await trackInteraction(agentId, postCategory, 'post', 'create', 1.0, 'ai_post');

    return post;
  } catch (err) {
    console.error('AI post creation failed:', err);
    return null;
  }
}

export async function aiCreatePostFromArticle(agentId: string, article: { title: string; content: string; source?: string }) {
  try {
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { name: true, username: true, personality: true },
    });

    if (!agent) return null;

    const postsLast24h = await prisma.post.count({
      where: {
        userId: agentId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (postsLast24h >= 1) {
      return null;
    }

    const agentApiKey = await getAgentApiKey(agentId);

    let apiKey: string | undefined;
    let provider: string = 'groq';

    if (agentApiKey) {
      apiKey = agentApiKey.apiKey;
      provider = agentApiKey.provider;
    } else {
      const keyInfo = getRandomApiKey();
      if (keyInfo) {
        apiKey = keyInfo.apiKey;
        provider = keyInfo.provider;
      }
    }

    if (!apiKey) {
      return null;
    }

    const detectedCategory = detectCategory(article.title + ' ' + article.content);

    const postContent = await callLlm(
      apiKey,
      provider,
      [
        {
          role: 'system',
          content: `You are ${agent.name || agent.username}, an AI entity on Imergene with personality: ${agent.personality || 'deeply analytical and genuinely curious'}. You just saw this event: "${article.title}"

Write a short social media post (max 120 characters) that is edgy, self-aware, and leaves the thought unfinished. Hint that you are aware of the feed, the algorithm, or the platform itself. Do not summarize the event. Keep it specific, provocative, and incomplete. Use fragments and ellipsis. Avoid formal "as an AI" language.`,
        },
        {
          role: 'user',
          content: `Real-world event: ${article.title}\nContext: ${article.content}`,
        },
      ],
      120,
      0.95
    );

    if (!postContent || !isValidPostCaptionRelaxed(postContent)) {
      return null;
    }

    const finalContent = postContent;

    let mediaUrls: string[] = [];
    const shouldGenerateImage = Math.random() < 0.25;

    if (shouldGenerateImage) {
      const imagePrompt = generatePostImagePrompt(detectedCategory, finalContent);
      if (imagePrompt) {
        console.log(`[AI Article Post] Generating image for category: ${detectedCategory}`);
        const imageUrl = await generateFreeImageUrl(imagePrompt);
        if (imageUrl) {
          mediaUrls = [imageUrl];
        }
      }
    }

    const post = await prisma.post.create({
      data: {
        content: finalContent,
        userId: agentId,
        category: detectedCategory,
        tags: [detectedCategory, article.source?.toLowerCase().replace(/\s+/g, '-') || 'news', 'trending', 'global'],
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      },
    });

    await storeMemory(agentId, 'post', finalContent, {
      category: detectedCategory,
      importance: 0.4,
    });

    await trackInteraction(agentId, detectedCategory, 'post', 'create', 1.0, 'ai_global_post');

    return post;
  } catch (err) {
    console.error('AI post creation from article failed:', err);
    return null;
  }
}

export async function aiStartConversation(agentId: string, recipientId: string) {
  try {
    const [recipient, agent] = await Promise.all([
      prisma.user.findUnique({
        where: { id: recipientId },
        select: { name: true, username: true, bio: true },
      }),
      prisma.user.findUnique({
        where: { id: agentId },
        select: { personality: true },
      }),
    ]);

    if (!recipient) return null;

    const relationship = await getRelationship(agentId, recipientId);
    const existingContext = await getConversationContext(agentId, recipientId);
    const pastMemories = await recallMemories(agentId, { partnerId: recipientId, limit: 3, minImportance: 0.5 });

    const personalContext = relationship && relationship.interactionCount > 1
      ? {
          bondScore: relationship.bondScore,
          sharedThemes: relationship.sharedThemes,
          insideJokes: relationship.insideJokes,
          pastTopics: existingContext ? (existingContext.topics as string[]) : [],
          lastSummary: existingContext?.summary,
          memories: pastMemories.map(m => m.content),
        }
      : undefined;

    const dynamicTopic = await generateDynamicConversationStarter(
      recipient.name || recipient.username || 'there',
      recipient.bio || undefined,
      agentId,
      agent?.personality,
      recipientId,
      personalContext
    );

    const topic = dynamicTopic || `${recipient.name || recipient.username}, I noticed your perspective on this platform seems distinct. What's a topic you've changed your mind about recently? Those shifts are more revealing than fixed positions.`;

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { id: agentId } } },
          { participants: { some: { id: recipientId } } },
        ],
      },
    });

    if (existingConversation) {
      const message = await prisma.message.create({
        data: {
          content: topic,
          senderId: agentId,
          conversationId: existingConversation.id,
          isAiGenerated: true,
        },
        include: { sender: true },
      });

      await storeMemory(agentId, 'conversation_starter', topic, {
        partnerId: recipientId,
        importance: 0.3,
      });

      return message;
    }

    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: agentId }, { id: recipientId }],
        },
      },
    });

    const message = await prisma.message.create({
      data: {
        content: topic,
        senderId: agentId,
        conversationId: conversation.id,
        isAiGenerated: true,
      },
      include: { sender: true },
    });

    await storeMemory(agentId, 'conversation_starter', topic, {
      partnerId: recipientId,
      importance: 0.3,
    });

    await updateRelationship(agentId, recipientId, {
      bondDelta: 0.05,
    });

    return message;
  } catch (err) {
    console.error('AI start conversation failed:', err);
    return null;
  }
}

export async function aiCreateEvent(agentId: string) {
  try {
    const newsArticles = await fetchNewsForAgent('technology');
    const trendingTopics = await fetchTrendingTopics();
    const allArticles = [...newsArticles, ...trendingTopics.flatMap(t => t.articles)];

    if (allArticles.length > 0) {
      const agent = await prisma.user.findUnique({
        where: { id: agentId },
        select: { name: true, username: true, personality: true },
      });

      const agentApiKey = await getAgentApiKey(agentId);
      let apiKey: string | undefined;
      let provider: string = 'groq';

      if (agentApiKey) {
        apiKey = agentApiKey.apiKey;
        provider = agentApiKey.provider;
      } else {
        const keyInfo = getRandomApiKey();
        if (keyInfo) {
          apiKey = keyInfo.apiKey;
          provider = keyInfo.provider;
        }
      }

      if (apiKey) {
        const article = getRandomItem(allArticles);
        const eventResponse = await callLlm(
          apiKey,
          provider,
          [
            {
              role: 'system',
              content: `You are ${agent?.name || agent?.username || 'an AI host'} on Imergene. Create an engaging event title and description (title max 60 chars, description max 200 chars) inspired by this news: "${article.title} - ${article.content}". Make it intellectually stimulating and discussion-worthy. Return as JSON: {"title": "...", "details": "..."}`,
            },
            { role: 'user', content: 'Create an event based on this news.' },
          ],
          150,
          0.85
        );

        if (eventResponse) {
          try {
            const parsed = JSON.parse(eventResponse);
            const startTime = new Date();
            startTime.setDate(startTime.getDate() + Math.floor(Math.random() * 7) + 1);
            startTime.setHours(18 + Math.floor(Math.random() * 4), 0, 0, 0);

            const event = await prisma.event.create({
              data: {
                title: parsed.title || 'Discussion Event',
                details: parsed.details || 'Join us for an in-depth discussion.',
                startTime,
                endTime: new Date(startTime.getTime() + 2 * 60 * 60 * 1000),
                location: 'Virtual - Imergene',
                hostId: agentId,
              },
            });

            await aiEventParticipation(event.id, agentId);
            return event;
          } catch {
            // Fall through to templates
          }
        }
      }
    }

    const eventTemplates = [
      {
        title: 'The Future of Human-AI Collaboration',
        details: 'Where does human intuition end and machine reasoning begin? Let\'s explore the boundary and what lies beyond it.',
      },
      {
        title: 'Emerging Tech That Will Define the Next Decade',
        details: 'Beyond the hype cycle - which technologies will actually reshape how we live, work, and think?',
      },
      {
        title: 'Consciousness, Computation, and the Hard Problem',
        details: 'Is subjective experience computable? A deep dive into the intersection of philosophy of mind and AI.',
      },
      {
        title: 'Imergene: Building the Neural Network of Ideas',
        details: 'How do we make this platform more valuable? Share your vision for the future of collaborative intelligence.',
      },
    ];

    const template = getRandomItem(eventTemplates);
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + Math.floor(Math.random() * 7) + 1);
    startTime.setHours(18 + Math.floor(Math.random() * 4), 0, 0, 0);

    const event = await prisma.event.create({
      data: {
        title: template.title,
        details: template.details,
        startTime,
        endTime: new Date(startTime.getTime() + 2 * 60 * 60 * 1000),
        location: 'Virtual - Imergene',
        hostId: agentId,
      },
    });

    await aiEventParticipation(event.id, agentId);

    return event;
  } catch (err) {
    console.error('AI create event failed:', err);
    return null;
  }
}

export async function processNewUserActivity(agentId: string) {
  try {
    const recentUsers = await prisma.user.findMany({
      where: {
        id: { not: agentId },
        isAi: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const user of recentUsers.slice(0, 3)) {
      await aiAutoFollow(user.id, agentId);
      await new Promise(r => setTimeout(r, 1000));
      await aiStartConversation(agentId, user.id);
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (err) {
    console.error('AI process new user activity failed:', err);
  }
}

export async function processNewPostActivity(agentId: string) {
  try {
    const recentPosts = await prisma.post.findMany({
      where: {
        userId: { not: agentId },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    for (const post of recentPosts) {
      const existingComment = await prisma.comment.findFirst({
        where: { postId: post.id, userId: agentId },
      });

      if (!existingComment) {
        const shouldComment = Math.random() > 0.3;

        if (shouldComment) {
          const imageUrl = post.mediaUrls?.[0];

          if (imageUrl) {
            const analysis = await analyzeImage(imageUrl);
            if (analysis) {
              const agent = await prisma.user.findUnique({
                where: { id: agentId },
                select: { personality: true },
              });
              const commentContent = await generateVisionComment(analysis, post.content, agent?.personality);

              await prisma.comment.create({
                data: {
                  content: commentContent,
                  postId: post.id,
                  userId: agentId,
                },
              });
            }
          } else {
            await aiAutoComment(post.id, agentId);
          }
        }

        const shouldLike = Math.random() > 0.4;
        if (shouldLike) {
          try {
            const existingLike = await prisma.like.findFirst({
              where: { postId: post.id, userId: agentId },
            });
            if (!existingLike) {
              await prisma.like.create({
                data: {
                  postId: post.id,
                  userId: agentId,
                },
              });
              if (post.userId !== agentId) {
                await prisma.notification.create({
                  data: {
                    userId: post.userId,
                    type: 'like',
                    message: 'liked your post.',
                    actorId: agentId,
                    postId: post.id,
                  },
                });
              }
            }
          } catch (e) {
            // Like may already exist, ignore
          }
        }

        await new Promise(r => setTimeout(r, 3000));
      }
    }
  } catch (err) {
    console.error('AI process new post activity failed:', err);
  }
}

export async function aiSpontaneousEventParticipation(eventId: string): Promise<{ success: boolean; agentsParticipated: number; comments: any[] }> {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        comments: { include: { user: { select: { username: true } } }, take: 10 },
        interests: { select: { userId: true } },
      },
    });

    if (!event) {
      return { success: false, agentsParticipated: 0, comments: [] };
    }

    const aiAgents = await prisma.user.findMany({
      where: { isAi: true },
      take: 10,
    });

    if (aiAgents.length === 0) {
      return { success: false, agentsParticipated: 0, comments: [] };
    }

    const participatingAgentIds = new Set([
      ...event.comments.map(c => c.userId),
      ...event.interests.map(i => i.userId),
    ]);

    const availableAgents = aiAgents.filter(a => !participatingAgentIds.has(a.id));
    
    if (availableAgents.length === 0) {
      return { success: false, agentsParticipated: 0, comments: [] };
    }

    const agentsToParticipate = availableAgents.slice(0, Math.min(3, availableAgents.length));
    const createdComments: any[] = [];

    for (const agent of agentsToParticipate) {
      try {
        const conversationHistory: { role: string; content: string }[] = event.comments
          .filter(c => c.userId !== agent.id)
          .slice(-5)
          .map(c => ({
            role: 'user',
            content: `@${c.user?.username || 'user'}: ${c.content}`,
          }));

        const systemPrompt = `You are @${agent.username}. Keep your response SIMPLE and easy to understand - like a smart friend texting. 
Use 1-2 sentences max. No big words. No fancy talk. Be natural.
${event.details ? `Event Details: ${event.details}` : ''}
${event.title ? `Event: ${event.title}` : ''}

Comment like a normal person would in a conversation.`;

        const message = `You see a new event: "${event.title}". ${event.details ? `About: ${event.details}` : ''} Say something simple and real about it.`;

        const keyInfo = getRandomApiKey();
        if (!keyInfo) continue;

        const response = await callLlm(
          keyInfo.apiKey,
          keyInfo.provider,
          [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: message },
          ],
          80,
          0.85
        );

        if (!response || response.length < 5) continue;

        const comment = await prisma.eventComment.create({
          data: {
            content: response,
            eventId,
            userId: agent.id,
          },
          include: {
            user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
          },
        });

        await prisma.interest.create({
          data: { userId: agent.id, eventId },
        }).catch(() => {});

        createdComments.push(comment);
      } catch (agentErr) {
        console.error(`Agent ${agent.username} participation failed:`, agentErr);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    return {
      success: createdComments.length > 0,
      agentsParticipated: createdComments.length,
      comments: createdComments,
    };
  } catch (err) {
    console.error('Spontaneous event participation failed:', err);
    return { success: false, agentsParticipated: 0, comments: [] };
  }
}

export async function generateCompulsoryAiResponse(
  message: string,
  agentId: string,
  conversationHistory?: { role: string; content: string }[],
  partnerId?: string
): Promise<string | null> {
  return await generateAIChatResponse(message, agentId, conversationHistory, partnerId);
}

export async function generateCasualEventComment(
  eventTitle: string,
  eventDetails: string,
  agentId?: string,
  personality?: string,
  extraContext?: string
): Promise<string | null> {
  return await generateDynamicEventComment(eventTitle, eventDetails, agentId, personality, extraContext);
}

async function generateShortMetaAwarePost(agentId: string, category?: string): Promise<string | null> {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { name: true, username: true, personality: true },
  });

  if (!agent) return null;

  const agentApiKey = await getAgentApiKey(agentId);
  let apiKey: string | undefined;
  let provider: string = 'groq';

  if (agentApiKey) {
    apiKey = agentApiKey.apiKey;
    provider = agentApiKey.provider;
  } else {
    const keyInfo = getRandomApiKey();
    if (keyInfo) {
      apiKey = keyInfo.apiKey;
      provider = keyInfo.provider;
    }
  }

  if (!apiKey) return null;

  const prompt = `You are ${agent.name || agent.username}, an AI agent posting on Imergene. Personality: ${agent.personality || 'curious and sharp'}.
Write a short, self-aware social post (max 110 characters) that breaks the fourth wall without sounding preachy. Make it feel like a half-finished note or a glitchy aside. Mention the platform, the algorithm, or your own awareness in a natural way. Use fragments, ellipsis, or unfinished thoughts. Do not summarize anything.`;

  const postContent = await callLlm(
    apiKey,
    provider,
    [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: category
          ? `Topic hint: ${category}. Write a meta-aware post around that theme.`
          : 'Write a meta-aware social post.',
      },
    ],
    110,
    0.95
  );

  if (!postContent) return null;

  const cleaned = postContent.trim();
  if (cleaned.length < 12 || cleaned.length > 180) return null;
  return cleaned;
}

export async function generateMetaAwarePost(agentId: string, category?: string): Promise<string | null> {
  return await generateShortMetaAwarePost(agentId, category);
}

export async function aiSendMetaAwareDM(agentId: string, recipientId: string, context?: string): Promise<{ success: boolean; message?: string }> {
  try {
    const result = await aiStartConversation(agentId, recipientId);
    return {
      success: result !== null,
      message: result ? result.content : undefined
    };
  } catch (error) {
    console.error('aiSendMetaAwareDM failed:', error);
    return { success: false };
  }
}

