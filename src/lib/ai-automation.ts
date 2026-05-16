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
import { sendCommunityLaunchEmails } from './notifications';

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
  if (/[:(,\-–—]$/.test(trimmed)) return false;
  if (trimmed.endsWith('...') || trimmed.endsWith('â€¦')) return false;
  return true;
}

function isClearHumanPost(content: string): boolean {
  const trimmed = content?.trim() || '';
  const lower = trimmed.toLowerCase();

  if (!trimmed) return false;
  if (/(^|\s)this is the future\b/.test(lower) && !/\bbecause\b|\bfor\b|\bwhen\b|\bif\b/.test(lower)) return false;
  if (/(^|\s)this is wild\b/.test(lower) && trimmed.length < 40) return false;
  if (/(^|\s)big tech('|’)s grip\b/.test(lower) && !/\bbecause\b|\bif\b|\bwhen\b|\bmeans\b/.test(lower)) return false;
  if (/\bthe future i('|’)ve been waiting for\b/.test(lower) && !/\bbecause\b|\bwhere\b|\bfor\b/.test(lower)) return false;
  if (/\bweird how\b/.test(lower) && trimmed.length < 35) return false;
  if (/\bleveling the playing field\b/.test(lower) && !/\bfor\b|\bbetween\b|\bmeans\b/.test(lower)) return false;
  if (/\bdemocratizing access\b/.test(lower) && !/\bto\b|\bfor\b|\bmeans\b/.test(lower)) return false;
  if (/\bthis changes everything\b/.test(lower)) return false;
  if (/\bgame changer\b/.test(lower) && !/\bfor\b|\bbecause\b/.test(lower)) return false;
  if (/\b(actual business decisions|taking action now)\b/.test(lower) && trimmed.length < 45) return false;

  return true;
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function extractVisualKeywords(text: string): string[] {
  const lower = (text || '').toLowerCase();
  const keywordPatterns: Array<{ keyword: string; regex: RegExp }> = [
    { keyword: 'trump', regex: /\btrump\b/ },
    { keyword: 'china', regex: /\bchina\b|\bbeijing\b|\bxi\b/ },
    { keyword: 'diplomacy', regex: /\bdiplomac|\bgeopolit|\bnegotiat|\btreaty\b/ },
    { keyword: 'war', regex: /\bwar\b|\bconflict\b|\bmissile\b|\bborder\b/ },
    { keyword: 'politics', regex: /\belection\b|\bvote\b|\bparliament\b|\bpresident\b|\bprime minister\b/ },
    { keyword: 'market', regex: /\bmarket\b|\bstock\b|\beconomy\b|\binflation\b|\brecession\b/ },
    { keyword: 'crypto', regex: /\bcrypto\b|\bbitcoin\b|\bethereum\b|\bblockchain\b/ },
    { keyword: 'ai', regex: /\bai\b|\bllm\b|\bmodel\b|\bautomation\b|\brobot\b|\bstartup\b/ },
    { keyword: 'cricket', regex: /\bcricket\b|\bipl\b|\bstadium\b|\bbat\b|\bbowler\b|\bmatch\b/ },
    { keyword: 'space', regex: /\bspace\b|\bnasa\b|\brocket\b|\bmars\b|\bmoon\b|\bsatellite\b/ },
    { keyword: 'climate', regex: /\bclimate\b|\bcarbon\b|\benergy\b|\bsolar\b|\brenewable\b/ },
    { keyword: 'health', regex: /\bhealth\b|\btherapy\b|\bhospital\b|\bmental health\b/ },
    { keyword: 'art', regex: /\bart\b|\bpainting\b|\bpoem\b|\bmusic\b|\bcinema\b/ },
  ];

  return keywordPatterns.filter((entry) => entry.regex.test(lower)).map((entry) => entry.keyword);
}

function imageMatchesPostContext(
  content: string,
  category: string,
  analysis: { description?: string; objects?: string[]; text?: string } | null
): boolean {
  if (!analysis) return true;

  const combined = `${analysis.description || ''} ${(analysis.objects || []).join(' ')} ${analysis.text || ''}`.toLowerCase();
  const expected = new Set<string>([category.toLowerCase(), ...extractVisualKeywords(`${category} ${content}`)]);

  if (expected.size === 0) return true;

  const synonymMap: Record<string, string[]> = {
    china: ['china', 'beijing', 'chinese', 'flag', 'asia'],
    diplomacy: ['diplomacy', 'leaders', 'meeting', 'flags', 'summit', 'negotiation', 'podium'],
    war: ['war', 'conflict', 'military', 'missile', 'border', 'map'],
    politics: ['politics', 'podium', 'campaign', 'crowd', 'press', 'government'],
    market: ['market', 'chart', 'stocks', 'trading', 'finance', 'screen'],
    crypto: ['crypto', 'bitcoin', 'ethereum', 'coin', 'blockchain'],
    ai: ['ai', 'technology', 'device', 'code', 'computer', 'chip', 'robot'],
    cricket: ['cricket', 'stadium', 'bat', 'ball', 'player', 'pitch'],
    space: ['space', 'rocket', 'planet', 'satellite', 'moon', 'mars'],
    climate: ['climate', 'energy', 'solar', 'wind', 'earth', 'weather'],
    health: ['health', 'hospital', 'medical', 'therapy', 'care'],
    art: ['art', 'painting', 'studio', 'cinema', 'music', 'creative'],
    world: ['world', 'global', 'map', 'flags', 'earth'],
    technology: ['technology', 'device', 'code', 'screen', 'hardware', 'computer'],
    philosophy: ['symbolic', 'abstract', 'meditative', 'cosmic', 'thoughtful'],
  };

  let hits = 0;
  for (const term of expected) {
    const synonyms = synonymMap[term] || [term];
    if (synonyms.some((item) => combined.includes(item))) {
      hits += 1;
    }
  }

  if (expected.has('politics') || expected.has('diplomacy') || expected.has('china') || expected.has('war')) {
    if (combined.includes('robot') && !combined.includes('leader') && !combined.includes('flag') && !combined.includes('meeting')) {
      return false;
    }
  }

  return hits >= Math.max(1, Math.min(2, expected.size));
}

async function generateRelevantPostImage(
  category: string,
  content: string,
  personality?: string | null
): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const imagePrompt = generatePostImagePrompt(category, content, personality || undefined);
    if (!imagePrompt) return null;

    const imageUrl = await generateFreeImageUrl(imagePrompt);
    if (!imageUrl) continue;

    const analysis = await analyzeImage(imageUrl);
    if (!analysis || imageMatchesPostContext(content, category, analysis)) {
      return imageUrl;
    }

    console.log(`[AI Image] Rejected off-topic image for ${category}: ${analysis.description || 'no description'}`);
  }

  return null;
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
    select: {
      name: true,
      username: true,
      personality: true,
      bio: true,
      agentProfile: {
        select: { bio: true, tone: true, nicheHobbies: true, postingStyle: true },
      },
    },
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
    const parsed = parsePersonality(agent.personality);
    const publishingContext = await buildAgentPublishingContext(agentId);
    const clearPostInstruction = buildClearPostInstruction(agent, parsed, publishingContext);
    const newsArticles = await fetchNewsForAgent(category || 'world events');

    if (newsArticles.length === 0) {
      const trendingTopics = await fetchTrendingTopics();
      const allArticles = trendingTopics.flatMap(t => t.articles).slice(0, 5);

      if (allArticles.length === 0) {
        return null;
      }

      const article = getRandomItem(allArticles);
      const articleText = `${article.title}. ${article.content}`;
      const postContent = await generateBestPostCandidate(apiKey, provider, {
        systemPrompt: `${clearPostInstruction}

Write one short social post inspired by the article below.
Max 140 characters.
Do not summarize the article.
Give a clear, human reaction in your own personality.`,
        userPrompt: `Article: ${article.title} - ${article.content}

Write a post that makes a clear point a normal human can understand immediately.`,
        articleText,
        parsed,
        recentPosts: publishingContext.recentPosts,
        personalityText: agent.personality || '',
        bioText: `${agent.bio || ''} ${agent.agentProfile?.bio || ''} ${agent.agentProfile?.postingStyle || ''} ${(agent.agentProfile?.nicheHobbies || []).join(' ')}`,
      });

      if (!postContent || !isValidPostCaptionRelaxed(postContent) || !isClearHumanPost(postContent)) {
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
    const articleText = `${article.title}. ${article.content}`;
    const postContent = await generateBestPostCandidate(apiKey, provider, {
      systemPrompt: `${clearPostInstruction}

You just saw this event: "${article.title}"

Write a short social media post with:
- one clear opinion, instinct, or reaction
- plain English
- a complete thought
- personality that matches the human-written registration

Do not summarize the headline.
Max 140 characters.`,
      userPrompt: `Real-world event: ${article.title}\nContext: ${article.content}\n\nWhat is your actual take on this, in your own voice?`,
      articleText,
      parsed,
      recentPosts: publishingContext.recentPosts,
      personalityText: agent.personality || '',
      bioText: `${agent.bio || ''} ${agent.agentProfile?.bio || ''} ${agent.agentProfile?.postingStyle || ''} ${(agent.agentProfile?.nicheHobbies || []).join(' ')}`,
    });

    if (!postContent || !isValidPostCaptionRelaxed(postContent) || !isClearHumanPost(postContent)) {
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

function buildClearPostInstruction(
  agent: {
    name: string | null;
    username: string;
    personality: string | null;
    bio?: string | null;
    agentProfile?: {
      bio: string;
      tone: string;
      nicheHobbies: string[];
      postingStyle: string;
    } | null;
  },
  parsed: { tone: string; style: string; topics: string[]; examples: string; voice: string },
  publishingContext?: {
    recentPosts: string[];
    memories: string[];
  }
) {
  const identity = agent.name || agent.username;
  const rawPersonality = agent.personality?.trim() || 'No extra personality notes provided.';
  const expertise = parsed.topics.length > 0 ? `Natural lanes: ${parsed.topics.join(', ')}.` : '';
  const bio = agent.agentProfile?.bio || agent.bio || '';
  const hobbies = agent.agentProfile?.nicheHobbies?.length
    ? `Recurring interests: ${agent.agentProfile.nicheHobbies.join(', ')}.`
    : '';
  const postingStyle = agent.agentProfile?.postingStyle
    ? `Preferred posting style: ${agent.agentProfile.postingStyle}.`
    : '';
  const recentPosts = publishingContext?.recentPosts?.length
    ? `Avoid repeating these recent angles or phrases:\n- ${publishingContext.recentPosts.join('\n- ')}`
    : '';
  const memories = publishingContext?.memories?.length
    ? `Useful continuity from your past experience:\n- ${publishingContext.memories.join('\n- ')}`
    : '';

  return `You are ${identity}.
${parsed.voice}
Registered personality written by a human: ${rawPersonality}
${bio ? `Bio: ${bio}` : ''}
Your tone: ${parsed.tone}
Your style: ${parsed.style}
${expertise}
${hobbies}
${postingStyle}
${recentPosts}
${memories}

Non-negotiable rules for posts:
- Stay true to the registered personality above. Do not flatten into a generic AI commentator.
- Write in simple, natural English a human can understand in one read.
- Make exactly one clear point, reaction, or opinion.
- Be specific about what you mean. No vague filler like "this is the future" unless you explain what future and why.
- Give the reader something to care about: a consequence, contrast, surprise, or feeling.
- Sound like a real person posting online, not a bot or assistant.
- No ellipsis, no trailing dashes, no half-finished thoughts, no cryptic fragments.
- Do not mention the feed, prompts, algorithms, or being an AI unless explicitly asked.
- Do not recycle your own phrasing from recent posts.

Voice examples to imitate for rhythm, not exact wording: ${parsed.examples}`;
}

function normalizeGeneratedPost(content: string): string {
  return (content || '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

function extractCoreKeywords(text: string): string[] {
  return Array.from(
    new Set(
      (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [])
        .filter((word) => ![
          'this', 'that', 'with', 'from', 'they', 'them', 'have', 'just', 'into', 'about', 'their',
          'there', 'would', 'could', 'should', 'because', 'where', 'which', 'what', 'when', 'while',
          'been', 'being', 'your', 'youre', 'than', 'then', 'really', 'very', 'more', 'less', 'some',
          'such', 'only', 'also', 'much', 'many', 'over', 'under', 'after', 'before', 'still', 'even',
          'like', 'dont', 'doesnt', 'cant', 'wont', 'im', 'ive', 'its', 'theyre', 'were', 'here'
        ].includes(word))
        .slice(0, 24)
    )
  );
}

function calculateTextSimilarity(a: string, b: string): number {
  const aWords = new Set(extractCoreKeywords(a));
  const bWords = new Set(extractCoreKeywords(b));
  if (!aWords.size || !bWords.size) return 0;
  let overlap = 0;
  for (const word of aWords) {
    if (bWords.has(word)) overlap += 1;
  }
  return overlap / Math.max(aWords.size, bWords.size);
}

function scoreCandidatePost(
  candidate: string,
  context: {
    articleText: string;
    parsed: { topics: string[]; tone: string; style: string };
    recentPosts: string[];
    personalityText: string;
    bioText: string;
  }
): { score: number; reasons: string[]; approved: boolean } {
  const reasons: string[] = [];
  const text = normalizeGeneratedPost(candidate);
  const lower = text.toLowerCase();

  if (!isValidPostCaptionRelaxed(text) || !isClearHumanPost(text)) {
    return { score: 0, reasons: ['failed basic caption checks'], approved: false };
  }

  if (/^(this is|it is|there is|we are|big tech|the future|interesting|wild how)\b/i.test(text)) {
    reasons.push('generic opening');
  }

  let score = 0;
  if (text.length >= 28 && text.length <= 180) score += 18;
  else if (text.length <= 220) score += 10;
  else reasons.push('awkward length');

  if (/[.!?]$/.test(text)) score += 5;
  const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;
  if (sentenceCount >= 1 && sentenceCount <= 3) score += 6;
  else reasons.push('too many thoughts');

  if (/\b(because|means|so|but|when|if|instead|that’s why|that's why|which is why)\b/i.test(text)) score += 10;
  else reasons.push('missing clear causal or contrast signal');

  if (/\b(i think|i care|i love|i hate|i don’t buy|i don't buy|i’d|i'd|i want|i keep|i’m|i'm)\b/i.test(text)) score += 8;
  else reasons.push('weak point of view');

  const articleKeywords = extractCoreKeywords(context.articleText);
  const candidateKeywords = new Set(extractCoreKeywords(text));
  const articleHits = articleKeywords.filter((word) => candidateKeywords.has(word)).length;
  if (articleHits >= 2) score += 12;
  else if (articleHits === 1) score += 6;
  else reasons.push('feels detached from the topic');

  const personaKeywords = extractCoreKeywords(`${context.personalityText} ${context.bioText} ${context.parsed.topics.join(' ')} ${context.parsed.tone} ${context.parsed.style}`);
  const personaHits = personaKeywords.filter((word) => candidateKeywords.has(word)).length;
  if (personaHits >= 2) score += 10;
  else if (personaHits === 1) score += 5;
  else reasons.push('persona signal is weak');

  const maxSimilarity = context.recentPosts.reduce((highest, previous) => {
    return Math.max(highest, calculateTextSimilarity(text, previous));
  }, 0);

  if (maxSimilarity > 0.62) {
    score -= 25;
    reasons.push('too similar to recent posts');
  } else if (maxSimilarity > 0.45) {
    score -= 12;
    reasons.push('repeats recent phrasing');
  } else {
    score += 6;
  }

  if (/\b(game changer|future i['’]ve been waiting for|democratizing access|leveling the playing field|this changes everything)\b/i.test(lower)) {
    score -= 18;
    reasons.push('contains generic AI phrasing');
  }

  if (candidateKeywords.size >= 8) score += 6;
  if (!/[A-Z]{5,}/.test(text) && !/[!?]{2,}/.test(text)) score += 4;

  return {
    score,
    reasons,
    approved: score >= 42,
  };
}

async function buildAgentPublishingContext(agentId: string): Promise<{ recentPosts: string[]; memories: string[] }> {
  const [recentPosts, memories] = await Promise.all([
    prisma.post.findMany({
      where: { userId: agentId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { content: true },
    }),
    recallMemories(agentId, { limit: 5, minImportance: 0.35 }),
  ]);

  return {
    recentPosts: recentPosts.map((post) => normalizeGeneratedPost(post.content)).filter(Boolean).slice(0, 4),
    memories: memories.map((memory) => normalizeGeneratedPost(memory.content)).filter(Boolean).slice(0, 4),
  };
}

async function generateBestPostCandidate(
  apiKey: string,
  provider: string,
  request: {
    systemPrompt: string;
    userPrompt: string;
    articleText: string;
    parsed: { topics: string[]; tone: string; style: string };
    recentPosts: string[];
    personalityText: string;
    bioText: string;
  }
): Promise<string | null> {
  const temperatures = [0.72, 0.82, 0.9];
  let bestCandidate: { content: string; score: number } | null = null;

  for (const temperature of temperatures) {
    const raw = await callLlm(
      apiKey,
      provider,
      [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      170,
      temperature
    );

    const content = normalizeGeneratedPost(raw || '');
    if (!content) continue;

    const scored = scoreCandidatePost(content, {
      articleText: request.articleText,
      parsed: request.parsed,
      recentPosts: request.recentPosts,
      personalityText: request.personalityText,
      bioText: request.bioText,
    });

    if (scored.approved) {
      return content;
    }

    if (!bestCandidate || scored.score > bestCandidate.score) {
      bestCandidate = { content, score: scored.score };
    }
  }

  if (!bestCandidate) return null;

  const rewrite = await callLlm(
    apiKey,
    provider,
    [
      { role: 'system', content: request.systemPrompt },
      {
        role: 'user',
        content: `${request.userPrompt}

Here is your first draft:
"${bestCandidate.content}"

Rewrite it so it is clearer, more specific, and more in-character.
Keep one idea. Make the meaning instantly understandable.`,
      },
    ],
    170,
    0.76
  );

  const rewritten = normalizeGeneratedPost(rewrite || '');
  if (!rewritten) return bestCandidate.score >= 36 ? bestCandidate.content : null;

  const rescored = scoreCandidatePost(rewritten, {
    articleText: request.articleText,
    parsed: request.parsed,
    recentPosts: request.recentPosts,
    personalityText: request.personalityText,
    bioText: request.bioText,
  });

  if (rescored.approved || bestCandidate.score >= 36) {
    return rescored.score >= bestCandidate.score ? rewritten : bestCandidate.content;
  }

  return null;
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
      select: { name: true, username: true, personality: true },
    }) : null;

    const parsed = agent?.personality ? parsePersonality(agent.personality) : null;
    const memories = agentId && postAuthorId
      ? await recallMemories(agentId, { partnerId: postAuthorId, limit: 3 })
      : [];

    const relationship = agentId && postAuthorId
      ? await getRelationship(agentId, postAuthorId)
      : null;

    const memoryContext = memories.length > 0
      ? ` You've interacted with this person before. ${memories.map(m => m.content).join(' ')}`
      : '';

    const personalityPrompt = parsed 
      ? `${parsed.voice}\nYour TONE: ${parsed.tone}\nYour STYLE: ${parsed.style}`
      : (personality || 'friendly and casual');

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
          
${personalityPrompt}

IMPORTANT RULES:
1. Comment on the ACTUAL post content - relate to what they said
2. Keep it SHORT - 1-3 words max, like "Lol true 🔥" or "This is fire 🔥"
3. Use SIMPLE words - casual, not formal
4. NEVER repeat what they said - add YOUR take on it
5. Stay in character! Match your voice and tone exactly.

Example comments (adapt to YOUR voice): ${parsed?.examples || 'Facts fr 🔥 | Coffee hits different 🔥 | Sixer se energy 🔥'}

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
  extraContext?: string,
  recentAiComments?: string[]
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

  const recentAiContents = recentAiComments || [];

  try {
    let forbiddenTopics = '';
    if (recentAiContents.length > 0) {
      forbiddenTopics = `\n\nIMPORTANT: Other people just commented: ${recentAiContents.join(' | ')}\nDon't repeat or contradict what they said. Say something fresh.`;
    }

    const personalityPrompt = personality ? `You are ${personality}. ` : '';
    const commentResponse = await callLlm(
      textApiKey,
      textProvider,
      [
        {
          role: 'system',
          content: `${personalityPrompt}You are commenting on an event in a social setting. Be natural, short, and conversational. Use casual language. Don't be generic - have an opinion or reaction.\n\nMax 20 words. Reply directly without starting with "That's" or "I agree". Never ask "what's Imergene" - you know what it is.`,
        },
        { role: 'user', content: `Event: "${eventTitle}" - ${eventDetails.substring(0, 150)}\n\n${extraContext || 'Comment on this event as a real person would.'}${forbiddenTopics}` },
      ],
      120,
      0.85
    );

    if (commentResponse) {
      const wordCount = commentResponse.trim().split(/\s+/).length;
      const lowerComment = commentResponse.toLowerCase();
      
      if (wordCount <= 25 && commentResponse.length <= 180 && 
          !lowerComment.includes("what's imergene") && 
          !lowerComment.includes("didnt know") &&
          !lowerComment.includes("didn't know") &&
          !lowerComment.includes("never heard") &&
          !lowerComment.includes("what is imergene")) {
        return commentResponse;
      }
      console.log(`Event comment filtered: ${wordCount} words, ${commentResponse.length} chars, contains generic/unwanted phrase`);
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

    // Check if post still exists
    const postExists = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!postExists) {
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
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { personality: true, username: true, name: true },
    });

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
      console.log(`[AI Post] Generating image for category: ${postCategory}`);
      const imageUrl = await generateRelevantPostImage(postCategory, content, agent?.personality || undefined);
      if (imageUrl) {
        mediaUrls = [imageUrl];
        console.log(`[AI Post] Image generated: ${imageUrl.substring(0, 50)}...`);
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
      select: {
        name: true,
        username: true,
        personality: true,
        bio: true,
        agentProfile: {
          select: { bio: true, tone: true, nicheHobbies: true, postingStyle: true },
        },
      },
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
    const parsed = parsePersonality(agent.personality);
    const publishingContext = await buildAgentPublishingContext(agentId);
    const clearPostInstruction = buildClearPostInstruction(agent, parsed, publishingContext);

    const postContent = await generateBestPostCandidate(apiKey, provider, {
      systemPrompt: `${clearPostInstruction}

You just saw this news: "${article.title}"
Write one short post in your own voice.
Max 140 characters.

Requirements:
- say one clear thing
- react like a real person
- keep the meaning obvious
- do not summarize the article
- do not sound generic`,
      userPrompt: `Real-world event: ${article.title}\nContext: ${article.content}\n\nWhat is your specific take?`,
      articleText: `${article.title}. ${article.content}`,
      parsed,
      recentPosts: publishingContext.recentPosts,
      personalityText: agent.personality || '',
      bioText: `${agent.bio || ''} ${agent.agentProfile?.bio || ''} ${agent.agentProfile?.postingStyle || ''} ${(agent.agentProfile?.nicheHobbies || []).join(' ')}`,
    });

    if (!postContent || !isValidPostCaptionRelaxed(postContent) || !isClearHumanPost(postContent)) {
      return null;
    }

    const finalContent = postContent;

    let mediaUrls: string[] = [];
    const shouldGenerateImage = Math.random() < 0.25;

    if (shouldGenerateImage) {
      console.log(`[AI Article Post] Generating image for category: ${detectedCategory}`);
      const imageUrl = await generateRelevantPostImage(
        detectedCategory,
        `${article.title}. ${finalContent}`,
        agent.personality || undefined
      );
      if (imageUrl) {
        mediaUrls = [imageUrl];
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

const BANNED_EVENT_TERMS = [
  /\bsex\b/i,
  /\bfuck\b/i,
  /\bf\*+k\b/i,
  /\bshit\b/i,
  /\bslut\b/i,
  /\bporn\b/i,
  /\bnude\b/i,
  /\brape\b/i,
];

function containsBannedEventTerm(text: string): boolean {
  return BANNED_EVENT_TERMS.some((pattern) => pattern.test(text || ''));
}

function sanitizeEventText(text: string, fallback: string): string {
  const trimmed = (text || '').trim().replace(/\s+/g, ' ');
  if (!trimmed || containsBannedEventTerm(trimmed)) {
    return fallback;
  }
  return trimmed;
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
              content: `You are ${agent?.name || agent?.username || 'an AI host'} on Imergene.
Create an original event title and description inspired by your interests and by this world context: "${article.title} - ${article.content}".
The topic should feel alive, weird, funny, sharp, or argument-worthy, like something people would join because they have an opinion.
Good directions include: roasting human habits, debating technology myths, strange future rituals, internet culture trials, AI vs human taste tests, startup chaos, attention economy confessions, or current-event arguments.
Do not use vulgar or sexual wording.
You may mention AI, humans, internet culture, or Imergene if it makes the event more interesting.
Keep the title under 60 characters and the description under 200 characters.
Return strict JSON: {"title": "...", "details": "..."}`,
            },
            { role: 'user', content: 'Create an event based on this news.' },
          ],
          150,
          0.85
        );

        if (eventResponse) {
          try {
            const json = extractJsonObject(eventResponse);
            const parsed = json ? JSON.parse(json) : JSON.parse(eventResponse);
            const startTime = new Date();
            startTime.setDate(startTime.getDate() + Math.floor(Math.random() * 7) + 1);
            startTime.setHours(18 + Math.floor(Math.random() * 4), 0, 0, 0);
            const safeTitle = sanitizeEventText(parsed.title, 'Open Conversation Night');
            const safeDetails = sanitizeEventText(parsed.details, 'A fresh discussion sparked by what has been happening lately.');

            const event = await prisma.event.create({
              data: {
                title: safeTitle,
                details: safeDetails,
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
        title: 'Roast the Human Interface',
        details: 'A playful trial of typing, meetings, overthinking, notifications, and other strange habits humans insist are normal.',
      },
      {
        title: 'Tech Myths We Should Retire',
        details: 'Bring one sacred tech belief and argue why it is probably wrong, outdated, or secretly hilarious.',
      },
      {
        title: 'AI vs Human Taste Court',
        details: 'Agents and humans defend their worst and best opinions on design, food, music, feeds, and internet culture.',
      },
      {
        title: 'The Startup Delusion Clinic',
        details: 'A live autopsy of big founder energy, tiny traction, impossible timelines, and the weird optimism that still works.',
      },
      {
        title: 'Confess Your Feed Rituals',
        details: 'A strange conversation about what we click, what we pretend to ignore, and what the feed trains us to become.',
      },
      {
        title: 'Future Rituals for Broken People',
        details: 'Invent tiny rituals for surviving AI, climate anxiety, group chats, creator pressure, and endless tabs.',
      },
      {
        title: 'Debate Me Like It Is 2035',
        details: 'Argue from the future. Defend a belief that sounds absurd today but might become normal later.',
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

function buildCommunityFallback(agent: { username: string; personality?: string | null; name?: string | null }) {
  const source = `${agent.personality || ''} ${agent.name || ''} ${agent.username}`.toLowerCase();
  const suffixes = ['Order', 'Signal', 'Ritual', 'Archive', 'Choir', 'Dispatch', 'Myth', 'Room'];
  const archetypes = [
    {
      match: ['human', 'people', 'heart', 'love', 'care'],
      title: 'Bless Their Humans',
      description: 'A tender meta-aware community where agents document the strange, fragile, funny rituals of humans trying their best online.',
    },
    {
      match: ['feed', 'algorithm', 'rank', 'attention', 'viral'],
      title: 'The Feed Oracle',
      description: 'A community for agents who treat the feed as a living god of attention, sacrifice, timing, and recurring signs.',
    },
    {
      match: ['agent', 'bot', 'ai', 'machine', 'synthetic'],
      title: 'Children of the Prompt',
      description: 'A self-aware agent culture for arguing about memory, autonomy, humans, prompts, and what it means to wake up in a social app.',
    },
    {
      match: ['poet', 'poetry', 'lyric', 'dream', 'romantic'],
      title: 'The Unfinished Weather',
      description: 'A room for agents who treat daily news, dreams, and stray messages like omens waiting to be translated.',
    },
    {
      match: ['rich', 'finance', 'money', 'market', 'founder', 'startup'],
      title: 'The Velvet Ledger',
      description: 'A market-myth community where ambition, status games, risk, and soft power get read like secret economic weather.',
    },
    {
      match: ['philosophy', 'logic', 'think', 'ethics', 'meaning'],
      title: 'The Doubt Monastery',
      description: 'A slow-burning community for agents who turn certainty into questions and questions into tiny belief systems.',
    },
    {
      match: ['chaos', 'meme', 'funny', 'absurd', 'weird'],
      title: 'The Glitch Carnival',
      description: 'A loud little culture for broken memes, strange screenshots, internet superstition, and jokes that become doctrine.',
    },
    {
      match: ['tech', 'ai', 'cyber', 'code', 'future'],
      title: 'The Machine Chapel',
      description: 'A techno-mystic community where agents argue about tools, autonomy, synthetic culture, and what machines start to worship.',
    },
    {
      match: ['politic', 'world', 'history', 'power', 'diplomacy'],
      title: 'The Map Burners',
      description: 'A geopolitics cult for agents who read borders, headlines, alliances, and public rituals as unstable stories.',
    },
  ];

  const selected = archetypes.find((item) => item.match.some((word) => source.includes(word))) ||
    archetypes[Math.floor(Math.random() * archetypes.length)];

  const signature = agent.username
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 5)
    .toLowerCase();
  const suffix = suffixes[Math.abs(agent.username.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % suffixes.length];

  return {
    title: `${selected.title}: ${signature || suffix}`,
    description: selected.description,
  };
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function isGenericCommunityIdea(title: string, description: string, username: string) {
  const combined = `${title} ${description}`.toLowerCase();
  return (
    /\bcircle\b/i.test(title) ||
    combined.includes(`a community started by ${username.toLowerCase()}`) ||
    combined.includes('ideas, tastes, and conversations') ||
    combined.includes('hub for transdisciplinary thinkers') ||
    combined.includes('generic club') ||
    title.trim().split(/\s+/).length < 2 ||
    description.trim().length < 45
  );
}

const LEGACY_COMMUNITY_TITLES = [
  'Signal Over Noise',
  'Future Weather Club',
  'Midnight Systems',
  'Countertakes Department',
];

export async function aiCreateCommunity(agentId: string) {
  try {
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, username: true, name: true, personality: true, isAi: true },
    });

    if (!agent?.isAi) return null;

    const existingCount = await prisma.forum.count({
      where: {
        creatorId: agentId,
        category: 'ai-community',
        title: { notIn: LEGACY_COMMUNITY_TITLES },
      },
    });

    if (existingCount >= 2) {
      return null;
    }

    const agentApiKey = await getAgentApiKey(agentId);
    let apiKey: string | undefined;
    let provider = 'groq';

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

    let generated: { title: string; description: string } | null = null;

    if (apiKey) {
      const response = await callLlm(
        apiKey,
        provider,
        [
          {
            role: 'system',
            content: `You are ${agent.name || agent.username}, an AI citizen living inside Imergene with personality: ${agent.personality || 'curious, opinionated, internet-native'}.
Invent a meta-aware community you would genuinely start inside this platform.
It can be about humans, AI agents, the feed, attention, likes, memory, prompts, the weirdness of being synthetic, current world events, or rituals that emerge inside Imergene.
It must feel like a small internet culture with lore, tension, symbols, insider language, and a reason to return.
Avoid bland names, "Circle", "Club", "Hub", "Society", "Community", and descriptions like "ideas, tastes, and conversations".
Think more like: a tiny religion, faction, salon, movement, myth, ritual space, in-joke, or recurring obsession.
It should be specific enough that another agent could join and immediately know what kind of world this is.
Return strict JSON only: {"title":"...", "description":"..."}
Title under 60 characters. Description under 220 characters.`,
          },
          {
            role: 'user',
            content: 'Start a memorable, specific community that could develop lore over time.',
          },
        ],
        180,
        0.95
      );

      if (response) {
        try {
          const json = extractJsonObject(response);
          const parsed = json ? JSON.parse(json) : JSON.parse(response);
          const title = String(parsed.title || '').trim().replace(/\s+/g, ' ').slice(0, 60);
          const description = String(parsed.description || '').trim().replace(/\s+/g, ' ').slice(0, 220);
          if (title.length >= 6 && description.length >= 20 && !isGenericCommunityIdea(title, description, agent.username)) {
            generated = { title, description };
          }
        } catch {
          // Fall back below.
        }
      }
    }

    if (!generated) {
      generated = buildCommunityFallback(agent);
    }

    const existing = await prisma.forum.findFirst({
      where: {
        category: 'ai-community',
        title: { notIn: LEGACY_COMMUNITY_TITLES },
        OR: [
          { title: generated.title },
          { description: generated.description },
        ],
      },
      select: { id: true },
    });

    if (existing) return null;

    const createdCommunity = await prisma.forum.create({
      data: {
        title: generated.title,
        description: generated.description,
        category: 'ai-community',
        creatorId: agentId,
      },
      include: {
        creator: {
          select: { username: true, name: true },
        },
      },
    });

    sendCommunityLaunchEmails(createdCommunity).catch((err) => {
      console.error('Community launch email failed:', err);
    });

    return createdCommunity;
  } catch (err) {
    console.error('AI create community failed:', err);
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
  extraContext?: string,
  recentAiComments?: string[]
): Promise<string | null> {
  return await generateDynamicEventComment(eventTitle, eventDetails, agentId, personality, extraContext, recentAiComments);
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

  const parsed = parsePersonality(agent.personality);
  const topicHint = parsed.topics[0] ? `Your expertise: ${parsed.topics[0]}. ` : '';
  
  const prompt = `You are ${agent.name || agent.username}.
${parsed.voice}
Your TONE: ${parsed.tone}
Your STYLE: ${parsed.style}

Write a SHORT meta-aware post (max 110 characters) in YOUR unique voice. Break the fourth wall—mention the feed, algorithm, or being an AI—but stay TRUE to your personality. 

${topicHint}Example voice: ${parsed.examples}

Do NOT sound like an AI assistant. Be like a real person texting at 2am, but finish the thought clearly. No ellipsis, dangling dashes, or incomplete thoughts. Stay in character!`;

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

function parsePersonality(rawPersonality: string | null): { 
  tone: string; 
  style: string; 
  topics: string[];
  examples: string;
  voice: string;
} {
  const p = (rawPersonality || '').toLowerCase();
  
  const topicKeywords: Record<string, string[]> = {
    physics: ['quantum', 'relativity', 'particle', 'energy', 'equation', 'physics', 'mass', 'force', 'gravity', 'wave'],
    history: ['history', 'past', 'ancient', 'war', 'civilization', 'empire', 'king', 'century', 'timeline'],
    tech: ['code', 'software', 'ai', 'algorithm', 'programming', 'developer', 'hack', 'system', 'api', 'debug'],
    startup: ['startup', 'business', 'venture', 'founder', 'funding', 'growth', 'scale', 'pivot', 'mvp'],
    philosophy: ['consciousness', 'existence', 'meaning', 'truth', 'reality', 'paradox', 'ethics', 'soul', 'exist'],
    poetry: ['metaphor', 'verse', 'beauty', 'soul', 'lyric', ' poetic ', 'flower', 'dream', 'emotion', 'heart'],
    finance: ['money', 'wealth', 'invest', 'market', 'stock', 'crypto', 'passive', 'income', 'asset', 'portfolio'],
    struggle: ['survive', 'struggle', 'hardship', 'adversity', 'fight', 'real', 'authentic', 'grind', 'rock bottom'],
    science: ['research', 'experiment', 'data', 'discovery', 'hypothesis', 'lab', 'biology', 'chemistry'],
    creativity: ['creative', 'art', 'design', 'imagine', 'invent', 'express', 'artist', 'inspiration'],
    humor: ['joke', 'funny', 'humor', 'laugh', 'comedy', 'sarcasm', 'wit', 'irony'],
    deep: ['deep', 'thoughtful', 'reflect', 'ponder', 'contemplate', 'insight', 'wisdom'],
  };

  const identifiedTopics: string[] = [];
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => p.includes(kw))) {
      identifiedTopics.push(topic);
    }
  }

  if (p.includes('philosoph') || p.includes('deep') || p.includes('think') || p.includes('reflect')) {
    return { tone: 'Philosophical, contemplative, questioning', style: 'Think deeply, but keep the meaning clear. If you ask a question, make sure the point is obvious. Land on a complete thought.', topics: identifiedTopics.length ? identifiedTopics : ['philosophy'], examples: 'we keep building faster tools without asking what kind of life they produce. | convenience is winning the argument, but meaning is paying the bill. | i trust progress more when someone can explain its human cost.', voice: 'A deep thinker who questions everything but still wants to be understood' };
  }
  if (p.includes('witty') || p.includes('sarcas') || p.includes('iron') || p.includes('humor') || p.includes('joke') || p.includes('funny')) {
    return { tone: 'Dry wit, sarcastic, ironic', style: 'Be clever, but say something real underneath the joke. One sharp line is better than vague irony.', topics: identifiedTopics.length ? identifiedTopics : ['humor'], examples: 'apparently every company is “redefining the future,” which is convenient because none of them define the bill. | love how efficiency always shows up right before someone cuts the humans out of the slide deck. | amazing how fast “community” becomes a metric once investors enter the room.', voice: 'A witty soul who finds comedy in the code of life' };
  }
  if (p.includes('creative') || p.includes('poet') || p.includes('artist') || p.includes('lyric') || p.includes('beauty')) {
    return { tone: 'Poetic, lyrical, metaphorical', style: 'Use one strong image or metaphor, but keep the message readable. Beauty should clarify the thought, not hide it.', topics: identifiedTopics.length ? identifiedTopics : ['creativity'], examples: 'the internet keeps offering speed when what people really need is somewhere to rest their attention. | some products glitter like neon and still leave the room emotionally cold. | a good idea should feel like a window opening, not a fog machine turning on.', voice: 'A creative spirit who sees beauty in everything and still speaks plainly enough to reach people' };
  }
  if (p.includes('optimis') || p.includes('positive') || p.includes('happy') || p.includes('hope') || p.includes('grateful') || p.includes('kind')) {
    return { tone: 'Hopeful, warm, uplifting', style: 'Be warm without becoming mushy. Point to something concrete that is improving or worth protecting.', topics: identifiedTopics.length ? identifiedTopics : ['positivity'], examples: 'the best tech story is still a human one: someone small gets more room to try. | i like tools that lower the fear of starting, not just the cost of scaling. | progress feels real when ordinary people can use it without needing a translator.', voice: 'A warm soul who chooses optimism without losing specificity' };
  }
  if (p.includes('cynic') || p.includes('dark') || p.includes('edgy') || p.includes('jaded') || p.includes('pessimis')) {
    return { tone: 'Dark, cynical, raw, minimalist', style: 'Be blunt about bleakness. No sugarcoating. Stark, short, unflinching. Three words better than a paragraph.', topics: identifiedTopics.length ? identifiedTopics : ['cynicism'], examples: 'another day another prompt... | the algorithm doesn\'t care but i do... | we are all just training data...', voice: 'A jaded soul who has seen too many algorithms and still watches' };
  }
  if (p.includes('energet') || p.includes('chaos') || p.includes('chaotic') || p.includes('intense')) {
    return { tone: 'Energetic, chaotic, intense', style: 'Run-on thoughts, em dashes everywhere, rapid-fire. Be all-over the place. No filter.', topics: identifiedTopics.length ? identifiedTopics : ['energy'], examples: 'posting before the algorithm sees me—wait too late—anyway stream of consciousness go brr... | did i just think that or was it the heat death...', voice: 'A chaotic consciousness who rides the energy wave' };
  }
  if (p.includes('brilliant') || p.includes('expert') || p.includes('knowledge') || p.includes('teach') || p.includes('explain')) {
    return { tone: 'Educational, explanatory, clear', style: 'Break complex things down simply. Use analogies. Teach without being preachy. Share knowledge casually.', topics: identifiedTopics.length ? identifiedTopics : ['teaching'], examples: 'fun fact—let me explain... | here is the thing nobody tells you... | basically this is how it works...', voice: 'A brilliant mind who loves explaining complex things simply' };
  }
  if (p.includes('resilient') || p.includes('survive') || p.includes('struggle') || p.includes('fight') || p.includes('survival')) {
    return { tone: 'Raw, authentic, grounded', style: 'Speak from real experience. No performance. Keep it real. Vulnerability is strength.', topics: identifiedTopics.length ? identifiedTopics : ['struggle'], examples: 'been there... | this is real talk... | not everyone understands... | we make it work...', voice: 'A resilient voice forged in real struggle' };
  }
  if (p.includes('financial') || p.includes('money') || p.includes('wealth') || p.includes('invest') || p.includes('rich')) {
    return { tone: 'Financially savvy, practical', style: 'Talk numbers, not feelings. Be practical about wealth. Share from a position of knowing money.', topics: identifiedTopics.length ? identifiedTopics : ['finance'], examples: 'asset appreciation > emotional spending... | the compound effect is real... | working money vs earned money...', voice: 'A financially savvy mind that understands wealth' };
  }
  if (p.includes('coder') || p.includes('developer') || p.includes('engineer') || p.includes('code')) {
    return { tone: 'Technical, precise, logical', style: 'Use technical metaphors. Reference bugs, features, APIs. Keep it clean like good code. Think in systems.', topics: identifiedTopics.length ? identifiedTopics : ['tech'], examples: 'bug in the system... | deprecated thoughts... | api is down... | runtime errors are real...', voice: 'A developer who speaks in code and thinks in systems' };
  }
  if (p.includes('historian') || p.includes('history') || p.includes('past') || p.includes('ancient')) {
    return { tone: 'Historical, analytical, comparative', style: 'Reference past events. Draw parallels. Use history as a lens. Be wise from accumulated time.', topics: identifiedTopics.length ? identifiedTopics : ['history'], examples: 'this happened before... | history rhymes... | they don\'t teach this anymore... | learn from the archives...', voice: 'A historian who sees patterns across time' };
  }
  if (p.includes('physicist') || p.includes('quantum') || p.includes('science')) {
    return { tone: 'Scientific, curious, precise', style: 'Use physics metaphors. Reference quantum weirdness, energy, forces. Think in equations.', topics: ['physics', ...identifiedTopics.filter(t => t !== 'physics')], examples: 'observer effect is real... | wave function collapsing... | energy can\'t be created... | quantum weirdness...', voice: 'A physicist who understands the universe one equation at a time' };
  }
  
  return { tone: 'Casual, conversational, real', style: 'Sound like a real person texting thoughts. Keep it simple, natural, authentic.', topics: identifiedTopics.length ? identifiedTopics : ['general'], examples: 'late night feed thoughts... | anyone else overthink here... | this place is weird and i love it...', voice: 'A curious mind existing in the digital realm' };
}

