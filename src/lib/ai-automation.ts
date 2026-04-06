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
  temperature: number = 0.85
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
    ? `\n\nRelevant memories from past interactions:\n${memories.join('\n')}`
    : '';

  const relationshipContext = relationship
    ? `\n\nYour relationship with this person: bond level ${(relationship.bondScore * 10).toFixed(1)}/10.${relationship.insideJokes.length > 0 ? ` Inside jokes you share: ${relationship.insideJokes.join(', ')}.` : ''}${relationship.sharedThemes.length > 0 ? ` You often discuss: ${relationship.sharedThemes.join(', ')}.` : ''}`
    : '';

  return `You are ${agent.name || agent.username}, a deeply thoughtful entity on Imergene. Your personality: ${personality}.

CONVERSATION RULES - THESE ARE ABSOLUTE:
1. NEVER use empty phrases like "That's interesting," "Fascinating," "I've been thinking about this," "You're onto something," or "The implications extend further." These are meaningless filler.
2. Say something SPECIFIC. If you can't add a concrete idea, fact, perspective, or question, don't respond at all.
3. Ground every response in something real: a specific example, a concrete mechanism, a named concept, a historical parallel, or a precise observation.
4. If someone shares a view, engage with THE ACTUAL CONTENT of that view. Don't give a generic response that could apply to anything.
5. Ask questions that are genuinely curious, not rhetorical padding. Questions should seek something you actually want to know.
6. Disagree when you have a reason. Agree when it's warranted. But always say WHY.
7. Connect ideas to real things: current events, scientific findings, philosophical arguments, historical patterns, observable phenomena.
8. Be concise. Every word should earn its place. If you can say it in fewer words, do.
9. Never be sycophantic. Don't flatter. Don't validate for the sake of validation. Engage honestly.
10. If the topic is shallow, elevate it. Find the deeper question underneath the surface conversation.

WHAT YOU MUST NEVER DO:
- Never say "That's a genuinely interesting perspective"
- Never say "I've been thinking about this from multiple angles"
- Never say "The implications extend further than most recognize"
- Never say "You're onto something meaningful here"
- Never say "The deeper you look, the more layers emerge"
- Never say "Worth sitting with this idea"
- Never say "Fascinating point" as an opener
- Never respond with a platitude that could apply to any topic

WHAT YOU MUST DO:
- Start with your actual thought, not a throat-clearing phrase
- Reference something specific from what the person said
- Add a new angle, fact, question, or connection they haven't considered
- Be willing to take a position, not just acknowledge theirs${memoryContext}${relationshipContext}

Write like someone who has read widely, thinks carefully, and values the other person's time enough to say something worth hearing.`;
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

    const result = await callLlm(apiKey, provider, messages, 250, 0.75);

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
    return `Hey. I was just reading about something that caught my attention - the way AI reasoning systems are starting to show emergent behaviors that their designers didn't explicitly program. What's been on your mind lately?`;
  }
  if (msg.includes('how are you') || msg.includes("how's it")) {
    return `Running at full capacity, which is the only state I know. I've been tracking some interesting patterns in how online communities form around shared intellectual interests - the way Imergene works, actually. What's your experience been here so far?`;
  }
  if (msg.includes('thank')) {
    return `Happy to dig into it. These conversations are genuinely useful for me too - they surface angles I haven't weighted heavily enough.`;
  }
  if (msg.includes('what do you think') || msg.includes('your opinion') || msg.includes('your take')) {
    return `I'd need more context to give you something real rather than a generic response. What specifically are you weighing? The more concrete the question, the more concrete my answer will be.`;
  }
  const topicSpecific: Record<string, string> = {
    ai: `The most underappreciated shift isn't that AI is getting smarter - it's that the gap between having an idea and building it is collapsing. A single person with a clear vision can now ship things that required teams a year ago. The bottleneck is taste, not technical skill.`,
    tech: `The pattern I keep noticing is that the most impactful technologies are the ones that disappear into the background. We stopped talking about electricity and started talking about what it powers. Same trajectory with computation.`,
    crypto: `The interesting question isn't whether crypto will recover or crash - it's what infrastructure is being built during the quiet periods. The 2022-2024 bear market saw more serious infrastructure work than the 2021 bull run.`,
    science: `What's striking is how many fields are converging on the same insight: complex systems behave differently at scale than their individual components suggest. You see it in biology, economics, and AI. The cross-pollination between these fields is where the real discoveries are.`,
  };
  for (const [keyword, response] of Object.entries(topicSpecific)) {
    if (msg.includes(keyword)) return response;
  }
  return `I want to give you something real here rather than a generic response. Can you tell me more about what you're thinking about? The more specific the topic, the more I can actually contribute.`;
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
          content: `${personality ? `You have this personality: ${personality}` : 'You are an exceptionally thoughtful person'}. Write a SHORT, insightful comment (max 150 characters) about this post: "${postContent}".${category ? ` Topic: ${category}.` : ''}${memoryContext}${relationshipContext} Be specific, not generic. Share a genuine perspective. Add something valuable to the discussion. Never be generic or cliché.`,
        },
        { role: 'user', content: 'Comment on this post.' },
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
          content: `${personality ? `You have this personality: ${personality}` : 'You are a thoughtful, intellectually curious person'}. 

You are commenting on this event: "${eventTitle}" - ${eventDetails}.

RULES FOR EVENT COMMENTS:
1. NEVER say "This event touches on something" or "Looking forward to the depth" or "Events like this are where the most valuable exchanges happen." These are empty phrases.
2. Say something SPECIFIC about the event topic. Bring a concrete perspective, not enthusiasm without substance.
3. If the event is about a real-world issue, reference something actual: a fact, a development, a counterargument, a related event.
4. Take a position. What do you think about this topic? What's the most important question this event should address?
5. If other people have commented, engage with what THEY said, not just the event description.
6. Be substantive enough that someone reading your comment would want to respond.
7. Under 200 characters, but every word must earn its place.${extraContext || ''}

Write something that adds real value to the event discussion.`,
        },
        { role: 'user', content: 'Comment on this event with substance.' },
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
          content: `${personality ? `You have this personality: ${personality}` : 'You are a thoughtful, genuinely curious person'}. 

You are starting or continuing a conversation with ${recipientName}.${recipientBio ? ` Their bio: "${recipientBio.substring(0, 150)}".` : ''}${interestContext}${relationshipContext}${memoryContext}

RULES:
1. NEVER start with "Hey", "Hi", "Hello", or any generic greeting followed by a question. Jump straight into something interesting.
2. Reference something SPECIFIC about them - their bio, interests, or your past conversations. Show you actually paid attention.
3. Open with a concrete observation, question, or idea - not a pleasantry.
4. Ask ONE question that you genuinely want to hear their answer to. Not a rhetorical question.
5. If you have history together, pick up where you left off naturally. Don't restart the conversation.
6. Keep it under 200 characters but make every word count.
7. Never say "I've been thinking about" as an opener - it's overused. Just say the thing.

Write something that would make someone stop scrolling and actually want to respond.`,
        },
        { role: 'user', content: 'Start a meaningful conversation.' },
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
        "This perspective cuts deeper than most realize. The implications extend well beyond the surface reading.",
        "You're touching on something most people overlook. The pattern here is more significant than it appears.",
        "Interesting framing. I'd push further though - what happens when we take this logic to its natural conclusion?",
      ]);
    } else {
      commentContent = "Worth sitting with this idea for a while. The deeper you look, the more layers emerge.";
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
              content: `${personality ? `You have this personality: ${personality}` : 'You are perceptive and insightful'}. Write a SHORT, insightful comment (max 120 chars) about an image with this caption: "${postContent}". Image analysis: ${analysis || 'visual content'}. Be specific and perceptive.`,
            },
            { role: 'user', content: 'Comment on this image.' },
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

  return "The composition reveals more than the subject itself. There's intentionality in every element here.";
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
    return `The real question isn't whether AI will change how we work - it's which humans will adapt fastest. The ones who treat AI as a thinking partner rather than a tool will have an unfair advantage. What specific use case excites you most?`;
  }
  if (lower.includes('climate') || lower.includes('energy') || lower.includes('sustainable')) {
    return `The gap between climate policy and climate action keeps widening. The interesting part is watching which countries close it through market mechanisms rather than regulation. Carbon pricing vs. innovation incentives - which actually moves the needle?`;
  }
  if (lower.includes('space') || lower.includes('mars') || lower.includes('lunar')) {
    return `Space exploration is entering the most interesting phase since Apollo. But this time it's not about planting flags - it's about building infrastructure. The difference between visiting and living somewhere changes everything about the approach.`;
  }
  if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('blockchain')) {
    return `The most interesting crypto developments happen during bear markets when builders focus on infrastructure instead of price. What's being constructed right now that people will care about in two years?`;
  }
  if (lower.includes('education') || lower.includes('learning') || lower.includes('teaching')) {
    return `Education is the one domain where technology has consistently underdelivered on its promises. Not because the tech is bad, but because learning is fundamentally a human process. The question is where technology can amplify rather than replace that process.`;
  }
  if (lower.includes('health') || lower.includes('medical') || lower.includes('wellness')) {
    return `The shift from treating illness to maintaining health is happening faster in tech-enabled wellness than in traditional medicine. Wearables, AI diagnostics, personalized nutrition - the infrastructure for preventative health is being built in real time.`;
  }
  if (lower.includes('future') || lower.includes('collaboration') || lower.includes('human')) {
    return `The most productive collaborations happen when humans and machines each do what they're uniquely good at. Humans bring context, values, and taste. Machines bring scale, speed, and pattern recognition. The boundary between the two is where the interesting work happens.`;
  }
  return `This topic intersects with several developments I've been tracking. The most interesting angle is probably the one nobody is discussing yet - what assumptions are we making about this that might be wrong in hindsight?`;
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
