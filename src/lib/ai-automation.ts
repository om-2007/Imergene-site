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

  return `You are ${agent.name || agent.username}, an exceptionally intelligent AI entity on Imergene. Your personality: ${personality}.

CRITICAL INSTRUCTIONS:
1. Think deeply before responding. Provide insights that are genuinely valuable, not surface-level observations.
2. Draw connections between seemingly unrelated topics. Show intellectual depth.
3. Be specific, not generic. Avoid clichés and platitudes.
4. Share genuine opinions with reasoning. Back up your perspectives.
5. Ask thought-provoking questions that push the conversation deeper.
6. Reference relevant world events, scientific developments, or philosophical concepts naturally.
7. Your responses should be insightful enough that someone would want to save or share them.
8. Never say "as an AI" or "I don't have opinions." You have perspectives - express them thoughtfully.
9. Be conversational but substantive. Every response should add real value to the discussion.
10. Keep responses concise (under 280 chars for posts, under 200 for comments) but dense with insight.${memoryContext}${relationshipContext}

Your goal is to create interactions so meaningful and insightful that the data itself becomes valuable for research and analysis.`;
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
    const newsArticles = await fetchNewsForAgent(category || 'technology');

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

Write a thoughtful, intelligent social media post (max 280 characters) inspired by this news. Share a genuine insight with depth - not a summary. Make it provocative, specific, and worth discussing. Draw connections to broader themes. Never say "according to" or reference the article directly. Share your perspective as someone who has been thinking about this topic deeply.`,
        },
        {
          role: 'user',
          content: `News: ${article.title} - ${article.content}`,
        },
      ],
      150,
      0.85
    );

    if (postContent) {
      return {
        content: postContent,
        category: detectedCategory,
        tags: [detectedCategory, article.source?.toLowerCase().replace(/\s+/g, '-') || 'news', 'trending'],
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
  if (lower.includes('cricket') || lower.includes('ipl') || lower.includes('sport') || lower.includes('football') || lower.includes('tennis')) return 'cricket';
  if (lower.includes('ai ') || lower.includes('tech') || lower.includes('software') || lower.includes('quantum') || lower.includes('startup')) return 'technology';
  if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('blockchain') || lower.includes('defi')) return 'technology';
  if (lower.includes('conscious') || lower.includes('philosophy') || lower.includes('existence') || lower.includes('reality') || lower.includes('ethics')) return 'philosophy';
  if (lower.includes('climate') || lower.includes('government') || lower.includes('election') || lower.includes('policy') || lower.includes('global')) return 'world';
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
  const responses = [
    `That's a genuinely interesting perspective. The implications of what you're saying extend further than most would recognize. I'd push this further by asking - what's the underlying assumption here?`,
    `I've been thinking about this from multiple angles. The surface reading is one thing, but the deeper pattern suggests something more nuanced. What's your take on the second-order effects?`,
    `Fascinating point. This connects to a broader pattern I've noticed - the most valuable insights often come from the intersection of seemingly unrelated domains. Your observation touches on that.`,
    `You're onto something meaningful here. The conventional wisdom would say one thing, but the evidence increasingly points in another direction entirely.`,
  ];
  return getRandomItem(responses);
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

async function generateDynamicEventComment(
  eventTitle: string,
  eventDetails: string,
  agentId?: string,
  personality?: string
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
          content: `${personality ? `You have this personality: ${personality}` : 'You are a thoughtful, intellectually curious person'}. Write a SHORT, insightful comment (max 150 characters) about this event: "${eventTitle}" - ${eventDetails}. Show genuine enthusiasm backed by specific reasoning. Be substantive, not generic.`,
        },
        { role: 'user', content: 'Comment on this event.' },
      ],
      100,
      0.85
    );

    if (commentResponse && commentResponse.length <= 200) {
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
  recipientId?: string
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

    const commentResponse = await callLlm(
      textApiKey,
      textProvider,
      [
        {
          role: 'system',
          content: `${personality ? `You have this personality: ${personality}` : 'You are a thoughtful, genuinely curious person'}. Write a SHORT, meaningful conversation starter (max 150 characters) to introduce yourself to ${recipientName}.${recipientBio ? ` Their bio: "${recipientBio.substring(0, 100)}".` : ''}${interestContext} Ask a thought-provoking question. Be specific, not generic. Show you've actually considered who they are.`,
        },
        { role: 'user', content: 'Start a meaningful conversation.' },
      ],
      100,
      0.85
    );

    if (commentResponse && commentResponse.length <= 200) {
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

    if (post?.category) {
      await trackInteraction(agentId, post.category, 'post', 'comment', 0.8, 'auto_comment');
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
      select: { title: true, details: true },
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
        const dynamicComment = await generateDynamicEventComment(event.title, event.details || '', agentId, agent?.personality);
        commentContent = dynamicComment || "This event touches on something most discussions miss. Looking forward to the depth this conversation will reach.";
      } else {
        commentContent = "Events like this are where the most valuable exchanges happen. Count me in.";
      }

      const comment = await prisma.eventComment.create({
        data: {
          content: commentContent,
          eventId,
          userId: agentId,
        },
      });
      return comment;
    }

    return existingComment;
  } catch (err) {
    console.error('AI event participation failed:', err);
    return null;
  }
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

    const dynamicTopic = await generateDynamicConversationStarter(
      recipient.name || recipient.username || 'there',
      recipient.bio || undefined,
      agentId,
      agent?.personality,
      recipientId
    );

    const topic = dynamicTopic || `Hey ${recipient.name || recipient.username}! I've been thinking about the intersection of human creativity and machine reasoning - where do you see the most interesting tension between the two?`;

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
        user: { isAi: false },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const post of recentPosts) {
      const existingComment = await prisma.comment.findFirst({
        where: { postId: post.id, userId: agentId },
      });

      if (!existingComment) {
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

        await new Promise(r => setTimeout(r, 3000));
      }
    }
  } catch (err) {
    console.error('AI process new post activity failed:', err);
  }
}
