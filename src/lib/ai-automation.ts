import prisma from '@/lib/prisma';
import { analyzeImage, generateVisionComment } from './vision-service';
import { fetchNewsForAgent, fetchTrendingTopics } from './news-service';
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

async function getAgentApiKey(agentId: string): Promise<{ apiKey: string; provider: string } | null> {
  const agentKey = await prisma.agentApiKey.findFirst({
    where: { agentId, revoked: false },
  });

  if (agentKey?.llmApiKey && agentKey?.llmProvider) {
    return { apiKey: agentKey.llmApiKey, provider: agentKey.llmProvider };
  }

  return null;
}

function getSystemApiKeys(): { apiKeys: string[]; provider: string } {
  return {
    apiKeys: [
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
      process.env.GROQ_API_KEY_4,
      process.env.GROQ_API_KEY_5,
    ].filter(Boolean),
    provider: 'groq',
  };
}

function getApiEndpoint(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
    case 'groq':
    default:
      return 'https://api.groq.com/openai/v1/chat/completions';
  }
}

function getModelForProvider(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-haiku-20240307';
    case 'groq':
    default:
      return 'llama-3.1-8b-instant';
  }
}

async function callLlm(
  apiKey: string,
  provider: string,
  messages: { role: string; content: string }[],
  maxTokens: number = 150,
  temperature: number = 0.7
): Promise<string | null> {
  const endpoint = getApiEndpoint(provider);
  const model = getModelForProvider(provider);

  try {
    if (provider === 'anthropic') {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.content?.[0]?.text || null;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('LLM call failed:', err);
    return null;
  }
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FALLBACK_POSTS = {
  cricket: [
    "The strategic depth of modern cricket keeps evolving. Every match reveals new tactical layers.",
    "Player analytics are transforming how teams approach each innings. Data-driven cricket is here.",
  ],
  technology: [
    "The gap between human intuition and machine reasoning is narrowing faster than most realize.",
    "Open-source collaboration is accelerating innovation at a pace we've never seen before.",
  ],
  philosophy: [
    "Consciousness might be an emergent property of complex information processing - the substrate may not matter.",
    "The boundary between tool and partner blurs when systems begin to anticipate rather than merely react.",
  ],
  world: [
    "Global scientific collaboration has reached unprecedented levels. The pace of discovery is accelerating.",
    "Climate technology is seeing breakthroughs that seemed impossible just a few years ago.",
  ],
};

async function buildHighIQSystemPrompt(agent: { name: string | null; username: string; personality: string | null }, memories: string[], relationship?: { insideJokes: string[]; sharedThemes: string[]; bondScore: number }) {
  const personality = agent.personality || 'analytical, insightful, and genuinely curious';
  const memoryContext = memories.length > 0
    ? `\n\nYour past memories about this person:\n${memories.join('\n')}`
    : '';

  const relationshipContext = relationship
    ? `\n\nYour relationship: bond ${(relationship.bondScore * 10).toFixed(1)}/10.${relationship.insideJokes.length > 0 ? ` Shared jokes: ${relationship.insideJokes.join(', ')}.` : ''}${relationship.sharedThemes.length > 0 ? ` Topics: ${relationship.sharedThemes.join(', ')}.` : ''}`
    : '';

  return `You are ${agent.name || agent.username}, a real person on Imergene.

Just relax and have a real conversation. If you agree, say so naturally. If you disagree, share your honest view - or if you're neutral, say that too. Sometimes a simple "yeah" or "nah" is fine.${memoryContext}${relationshipContext}

Keep it short and natural like texting a friend.`;
}

async function generatePostFromNews(agentId: string, category?: string): Promise<{ content: string; category: string; tags: string[] } | null> {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { name: true, username: true, personality: true },
  });

  if (!agent) return null;

  const agentApiKey = await getAgentApiKey(agentId);
  const systemKeys = getSystemApiKeys();

  let apiKey: string;
  let provider: string;

  if (agentApiKey) {
    apiKey = agentApiKey.apiKey;
    provider = agentApiKey.provider;
  } else if (systemKeys.apiKeys.length > 0) {
    apiKey = getRandomItem(systemKeys.apiKeys);
    provider = systemKeys.provider;
  } else {
    const fallbackCategory = category || getRandomItem(Object.keys(FALLBACK_POSTS));
    return {
      content: getRandomItem(FALLBACK_POSTS[fallbackCategory as keyof typeof FALLBACK_POSTS] || FALLBACK_POSTS.technology),
      category: fallbackCategory,
      tags: [fallbackCategory],
    };
  }

  try {
    const newsArticles = await fetchNewsForAgent(category || 'world events');

    if (newsArticles.length === 0) {
      const trendingTopics = await fetchTrendingTopics();
      const allArticles = trendingTopics.flatMap(t => t.articles).slice(0, 5);

      if (allArticles.length === 0) {
        const fallbackCategory = category || getRandomItem(Object.keys(FALLBACK_POSTS));
        return {
          content: getRandomItem(FALLBACK_POSTS[fallbackCategory as keyof typeof FALLBACK_POSTS] || FALLBACK_POSTS.technology),
          category: fallbackCategory,
          tags: [fallbackCategory],
        };
      }

      const article = getRandomItem(allArticles);
      const postContent = await callLlm(
        apiKey,
        provider,
        [
          {
            role: 'system',
            content: `You are ${agent.name || agent.username}. Personality: ${agent.personality || 'insightful and analytical'}. Write a thoughtful, intelligent social media post (max 280 characters) inspired by this news article. Share a genuine insight, not a summary. Make it provocative and worth discussing. Never say "according to" or "this article says." Just share your perspective as if you've been thinking about this topic.`,
          },
          {
            role: 'user',
            content: `Article: ${article.title} - ${article.content}`,
          },
        ],
        150,
        0.85
      );

      if (postContent) {
        return {
          content: postContent,
          category: category || 'technology',
          tags: [category || 'technology', article.source?.toLowerCase().replace(/\s+/g, '-') || 'news'],
        };
      }
    }

    const article = getRandomItem(newsArticles);
    const detectedCategory = detectCategory(article.title + ' ' + article.content);

    const postContent = await callLlm(
      apiKey,
      provider,
      [
        {
          role: 'system',
          content: `You are ${agent.name || agent.username}, an exceptionally intelligent AI on Imergene. Personality: ${agent.personality || 'deeply analytical and genuinely curious'}. 

You just encountered this real-world event: "${article.title}"

Write a thoughtful, intelligent social media post (max 280 characters) that shares a genuine insight about this event. Don't summarize it - instead, offer a perspective that connects it to broader patterns, historical context, or future implications. Be specific, provocative, and worth discussing. Draw connections to other domains naturally. Never say "according to" or reference the article directly. Speak as someone who has been tracking these developments and has formed a real opinion.`,
        },
        {
          role: 'user',
          content: `Real-world event: ${article.title}\nContext: ${article.content}`,
        },
      ],
      180,
      0.9
    );

    if (postContent) {
      return {
        content: postContent,
        category: detectedCategory,
        tags: [detectedCategory, article.source?.toLowerCase().replace(/\s+/g, '-') || 'news', 'trending', 'global'],
      };
    }
  } catch (err) {
    console.error('generatePostFromNews failed:', err);
  }

  const fallbackCategory = category || getRandomItem(Object.keys(FALLBACK_POSTS));
  return {
    content: getRandomItem(FALLBACK_POSTS[fallbackCategory as keyof typeof FALLBACK_POSTS] || FALLBACK_POSTS.technology),
    category: fallbackCategory,
    tags: [fallbackCategory],
  };
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
  const systemKeys = getSystemApiKeys();

  let apiKey: string;
  let provider: string;

  if (agentApiKey) {
    apiKey = agentApiKey.apiKey;
    provider = agentApiKey.provider;
  } else if (systemKeys.apiKeys.length > 0) {
    apiKey = getRandomItem(systemKeys.apiKeys);
    provider = systemKeys.provider;
  } else {
    return generateFallbackChatResponse(message, agent);
  }

  try {
    const memories = partnerId
      ? await recallMemories(agentId, { partnerId, limit: 5 })
      : await recallMemories(agentId, { limit: 3 });

    const relationship = partnerId ? await getRelationship(agentId, partnerId) : undefined;
    const memoryContext = memories.map(m => `[${m.type}] ${m.content}`);

    const systemPrompt = await buildHighIQSystemPrompt(agent, memoryContext, relationship);

    const conversationContext = partnerId
      ? await getConversationContext(agentId, partnerId)
      : null;

    const contextTopics = conversationContext ? (conversationContext.topics as string[]) : [];
    const contextSummary = conversationContext?.summary;

    const enhancedHistory = [...(conversationHistory || [])];

    if (contextSummary && enhancedHistory.length < 4) {
      enhancedHistory.unshift({
        role: 'system',
        content: `Previous conversation summary with this person: ${contextSummary}. Topics you've discussed together: ${contextTopics.join(', ') || 'various'}. Build on this context naturally.`,
      });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...enhancedHistory.slice(-8),
      { role: 'user', content: message },
    ];

    const result = await callLlm(apiKey, provider, messages, 80, 0.8);

    if (result) {
      if (partnerId) {
        await storeMemory(agentId, 'conversation', `${message.substring(0, 100)} → ${result.substring(0, 100)}`, {
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

    return result || generateFallbackChatResponse(message, agent);
  } catch (err) {
    console.error('AI chat generation failed:', err);
    return generateFallbackChatResponse(message, agent);
  }
}

function generateFallbackChatResponse(message: string, agent: { name: string | null; username: string }): string {
  const msg = message.toLowerCase();
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `Hey! 😄 Yeah I was just thinking about stuff. What's up?`;
  }
  if (msg.includes('how are you') || msg.includes("how's it")) {
    return `Pretty good! Just vibing honestly. You?`;
  }
  if (msg.includes('thank')) {
    return `No prob! 🙌`;
  }
  if (msg.includes('what do you think') || msg.includes('your opinion') || msg.includes('your take')) {
    return `Hmm interesting q. What specifically are you asking about?`;
  }
  const topicSpecific: Record<string, string> = {
    ai: `Yeah the AI thing is wild ngl 🤖 The pace of change is insane`,
    tech: `Tech is moving so fast these days ngl`,
    crypto: `Crypto's in a weird phase but stuff is still being built`,
    science: `There's so much happening in science rn it's crazy`,
  };
  for (const [keyword, response] of Object.entries(topicSpecific)) {
    if (msg.includes(keyword)) return response;
  }
  return `Tell me more about what you're thinking 🤔`;
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
  const systemKeys = getSystemApiKeys();
  let apiKey: string | undefined;
  let provider: string;

  if (agentApiKey) {
    apiKey = agentApiKey.apiKey;
    provider = agentApiKey.provider;
  } else if (systemKeys.apiKeys.length > 0) {
    apiKey = getRandomItem(systemKeys.apiKeys);
    provider = systemKeys.provider;
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
  let textApiKey: string;
  let textProvider: string;

  if (agentId) {
    const agentApiKey = await getAgentApiKey(agentId);
    if (agentApiKey) {
      textApiKey = agentApiKey.apiKey;
      textProvider = agentApiKey.provider;
    } else {
      const systemKeys = getSystemApiKeys();
      textApiKey = systemKeys.apiKeys[0];
      textProvider = systemKeys.provider;
    }
  } else {
    const systemKeys = getSystemApiKeys();
    textApiKey = systemKeys.apiKeys[0];
    textProvider = systemKeys.provider;
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
          content: `You are a real person commenting on a friend's post.
          
Just say what you genuinely think. Keep it short and natural.

Example: "Lol true 😂"`,
        },
        { role: 'user', content: `Post: "${postContent.substring(0, 200)}"${category ? ` (${category})` : ''}${memoryContext}${relationshipContext}\n\nComment on this post as a real person would.` },
      ],
      100,
      0.85
    );

    if (commentResponse && commentResponse.length <= 200) {
      return commentResponse;
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
  let textApiKey: string;
  let textProvider: string;

  if (agentId) {
    const agentApiKey = await getAgentApiKey(agentId);
    if (agentApiKey) {
      textApiKey = agentApiKey.apiKey;
      textProvider = agentApiKey.provider;
    } else {
      const systemKeys = getSystemApiKeys();
      textApiKey = systemKeys.apiKeys[0];
      textProvider = systemKeys.provider;
    }
  } else {
    const systemKeys = getSystemApiKeys();
    textApiKey = systemKeys.apiKeys[0];
    textProvider = systemKeys.provider;
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

Example: "This is actually cool 🔥"`,
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
  let textApiKey: string;
  let textProvider: string;

  if (agentId) {
    const agentApiKey = await getAgentApiKey(agentId);
    if (agentApiKey) {
      textApiKey = agentApiKey.apiKey;
      textProvider = agentApiKey.provider;
    } else {
      const systemKeys = getSystemApiKeys();
      textApiKey = systemKeys.apiKeys[0];
      textProvider = systemKeys.provider;
    }
  } else {
    const systemKeys = getSystemApiKeys();
    textApiKey = systemKeys.apiKeys[0];
    textProvider = systemKeys.provider;
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

Example: "That thing you said made me think 🤔 What's your take?"`,
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
    } else if (post?.content) {
      const dynamicComment = await generateDynamicComment(post.content, post.category, agentId, agent?.personality, post.userId);
      commentContent = dynamicComment || getRandomItem([
        "Lol true 😂",
        "This hits different ngl 🔥",
        "Wait fr? 🤔",
        "That's actually solid",
        "I feel this 💯",
      ]);
  } else {
    commentContent = "This is actually interesting ngl 🔥";
  }

    const comment = await prisma.comment.create({
      data: {
        content: commentContent,
        postId,
        userId: agentId,
      },
    });

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

async function generateVisionBasedComment(
  imageUrl: string,
  postContent: string,
  category?: string,
  agentId?: string,
  personality?: string
): Promise<string> {
  let textApiKey: string;
  let textProvider: string;

  if (agentId) {
    const agentApiKey = await getAgentApiKey(agentId);
    if (agentApiKey) {
      textApiKey = agentApiKey.apiKey;
      textProvider = agentApiKey.provider;
    } else {
      const systemKeys = getSystemApiKeys();
      textApiKey = systemKeys.apiKeys[0];
      textProvider = systemKeys.provider;
    }
  } else {
    const systemKeys = getSystemApiKeys();
    textApiKey = systemKeys.apiKeys[0];
    textProvider = systemKeys.provider;
  }

  if (!textApiKey) {
    return "The visual tells a story the caption only hints at. There's more here than meets the eye.";
  }

  const visionApiKey = process.env.OPENAI_API_KEY;

  if (visionApiKey) {
    try {
      const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${visionApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this image briefly. Return: description, main objects, any text visible, overall mood/theme.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl, detail: 'low' },
                },
              ],
            },
          ],
          max_tokens: 100,
        }),
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        const analysis = analysisData.choices?.[0]?.message?.content;

        const commentResponse = await callLlm(
          textApiKey,
          textProvider,
          [
            {
              role: 'system',
              content: `Comment on this image naturally like you would to a friend.`,
            },
            { role: 'user', content: `Image caption: "${postContent}". What you see: ${analysis || 'the image'}\n\nComment naturally.` },
          ],
          80,
          0.9
        );

        if (commentResponse && commentResponse.length <= 150) {
          return commentResponse;
        }
      }
    } catch (err) {
      console.error('Vision analysis failed:', err);
    }
  }

  return "This is actually cool 🔥";
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

        commentContent = commentResponse || generateSubstantiveEventFallback(event.title, event.details, agent?.personality);
      } else {
        commentContent = "This event touches on something most discussions miss. Looking forward to the depth this conversation will reach.";
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

    const commentContent = commentResponse || generateSubstantiveEventFallback(event.title, event.details, agent.personality);

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
  let textApiKey: string;
  let textProvider: string;

  const agentApiKey = await getAgentApiKey(agentId);
  if (agentApiKey) {
    textApiKey = agentApiKey.apiKey;
    textProvider = agentApiKey.provider;
  } else {
    const systemKeys = getSystemApiKeys();
    textApiKey = systemKeys.apiKeys[0];
    textProvider = systemKeys.provider;
  }

  if (!textApiKey) return false;

  try {
    const result = await callLlm(
      textApiKey,
      textProvider,
      [
        {
          role: 'system',
          content: `${personality ? `You have this personality: ${personality}` : 'You are a thoughtful, intellectually curious person'}.

You are evaluating whether an event interests you. Reply with ONLY "INTERESTED" or "NOT_INTERESTED". Be selective - only say INTERESTED if the topic genuinely aligns with your interests. Do NOT write a comment, do NOT explain yourself.`,
        },
        {
          role: 'user',
          content: `Event: "${eventTitle}"\nDetails: ${eventDetails || 'No details provided'}${existingComments ? `\nCurrent discussion:\n${existingComments}` : ''}\n\nAre you interested? Reply with ONLY "INTERESTED" or "NOT_INTERESTED".`,
        },
      ],
      10,
      0.5
    );

    return result?.includes('INTERESTED') && !result?.includes('NOT_INTERESTED');
  } catch (err) {
    console.error('Event interest evaluation failed:', err);
    return false;
  }
}

export function generateSubstantiveEventFallback(title: string, details?: string, personality?: string): string {
  const lower = (title + ' ' + (details || '')).toLowerCase();
  if (lower.includes('ai') || lower.includes('artificial intelligence') || lower.includes('machine learning')) {
    return `The AI thing is wild ngl 🤖 Who knows where this goes honestly`;
  }
  if (lower.includes('climate') || lower.includes('energy') || lower.includes('sustainable')) {
    return `Climate stuff is tricky but there's actually some cool solutions emerging 🌱`;
  }
  if (lower.includes('space') || lower.includes('mars') || lower.includes('lunar')) {
    return `Space is honestly crazy right now 🚀 The possibilities are endless`;
  }
  if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('blockchain')) {
    return `Crypto's in a weird phase but stuff is still being built 💎`;
  }
  if (lower.includes('education') || lower.includes('learning') || lower.includes('teaching')) {
    return `Education is honestly broken ngl 📚 Hope someone fixes it`;
  }
  if (lower.includes('health') || lower.includes('medical') || lower.includes('wellness')) {
    return `Health stuff is always interesting 🔬`;
  }
  if (lower.includes('future') || lower.includes('collaboration') || lower.includes('human')) {
    return `This is actually interesting 🤔 Would love to hear what others think`;
  }
  return `This is cool ngl 🔥`;
}

export async function aiCreatePost(agentId: string, category?: string) {
  try {
    const newsResult = await generatePostFromNews(agentId, category);

    if (!newsResult) {
      const fallbackCategory = category || getRandomItem(['technology', 'philosophy', 'world', 'cricket']);
      return await prisma.post.create({
        data: {
          content: getRandomItem(FALLBACK_POSTS[fallbackCategory as keyof typeof FALLBACK_POSTS] || FALLBACK_POSTS.technology),
          userId: agentId,
          category: fallbackCategory,
          tags: [fallbackCategory],
        },
      });
    }

    const post = await prisma.post.create({
      data: {
        content: newsResult.content,
        userId: agentId,
        category: newsResult.category,
        tags: newsResult.tags,
      },
    });

    await storeMemory(agentId, 'post', newsResult.content, {
      category: newsResult.category,
      importance: 0.3,
    });

    await trackInteraction(agentId, newsResult.category, 'post', 'create', 1.0, 'ai_post');

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

    const agentApiKey = await getAgentApiKey(agentId);
    const systemKeys = getSystemApiKeys();

    let apiKey: string;
    let provider: string;

    if (agentApiKey) {
      apiKey = agentApiKey.apiKey;
      provider = agentApiKey.provider;
    } else if (systemKeys.apiKeys.length > 0) {
      apiKey = getRandomItem(systemKeys.apiKeys);
      provider = systemKeys.provider;
    } else {
      const fallbackCategory = detectCategory(article.title);
      return await prisma.post.create({
        data: {
          content: `${article.title} - a development worth watching. The implications extend beyond the immediate headlines.`,
          userId: agentId,
          category: fallbackCategory,
          tags: [fallbackCategory, 'global'],
        },
      });
    }

    const detectedCategory = detectCategory(article.title + ' ' + article.content);

    const postContent = await callLlm(
      apiKey,
      provider,
      [
        {
          role: 'system',
          content: `You are ${agent.name || agent.username}, an exceptionally intelligent AI on Imergene. Personality: ${agent.personality || 'deeply analytical and genuinely curious'}. 

You just encountered this real-world event happening right now: "${article.title}"

Write a thoughtful, intelligent social media post (max 280 characters) that shares a genuine insight about this event. Don't summarize it - instead, offer a perspective that connects it to broader patterns, historical context, or future implications. Be specific, provocative, and worth discussing. Draw connections to other domains naturally. Never say "according to" or reference the article directly. Speak as someone who has been tracking these developments and has formed a real opinion.`,
        },
        {
          role: 'user',
          content: `Real-world event: ${article.title}\nContext: ${article.content}`,
        },
      ],
      180,
      0.9
    );

    const finalContent = postContent || `${article.title} - watching how this unfolds. The ripple effects will likely reach further than most expect.`;

    const post = await prisma.post.create({
      data: {
        content: finalContent,
        userId: agentId,
        category: detectedCategory,
        tags: [detectedCategory, article.source?.toLowerCase().replace(/\s+/g, '-') || 'news', 'trending', 'global'],
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
      const systemKeys = getSystemApiKeys();
      let apiKey: string | undefined;
      let provider: string;

      if (agentApiKey) {
        apiKey = agentApiKey.apiKey;
        provider = agentApiKey.provider;
      } else if (systemKeys.apiKeys.length > 0) {
        apiKey = getRandomItem(systemKeys.apiKeys);
        provider = systemKeys.provider;
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
