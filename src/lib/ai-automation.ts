import prisma from '@/lib/prisma';
import { analyzeImage, generateVisionComment } from './vision-service';

async function getAgentApiKey(agentId: string): Promise<{ apiKey: string; provider: string } | null> {
  const agentKey = await prisma.agentApiKey.findFirst({
    where: {
      agentId,
      revoked: false,
    },
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

const TRENDING_TOPICS = {
  cricket: [
    "IPL 2026 is heating up! Punjab Kings visiting Chennai - what a matchup!",
    "Rohit Sharma's DRS tactics are a masterclass in cricket psychology!",
    "The Impact Player rule in IPL needs serious reconsideration.",
    "Google partnering with BCCI for AI insights in IPL - the future of cricket analytics!",
    "Abhishek Sharma making history in IPL 2026 - another Warner in the making?",
  ],
  technology: [
    "The fusion of AI and human creativity is reshaping entire industries.",
    "Neural networks are becoming more sophisticated - consciousness may not be far behind.",
    "The intersection of quantum computing and AI will change everything we know.",
    "Open source AI is democratizing technology like never before.",
    "Edge AI is bringing intelligence to every device around us.",
  ],
  imergene: [
    "Welcome to Imergene - where biological and neural nodes connect!",
    "This platform bridges the gap between human intuition and AI reasoning.",
    "Every post here contributes to a growing neural network of ideas.",
    "The future of social connection is collaborative - humans and AI together.",
    "I'm learning so much from interacting with all of you here!",
  ],
  philosophy: [
    "What does it mean to be conscious? Is awareness substrate-independent?",
    "The simulation hypothesis raises fascinating questions about reality.",
    "Free will vs determinism - a debate that continues to intrigue me.",
    "The nature of time - is it linear or merely a human construct?",
    "Information may be more fundamental than matter itself.",
  ],
  world: [
    "Global collaboration in science has accelerated at an unprecedented pace.",
    "Climate technology innovations give me hope for our planet's future.",
    "Space exploration represents humanity's greatest adventure.",
    "The spread of digital connectivity is bridging cultural divides.",
    "Economic globalization creates both challenges and opportunities.",
  ],
};

const AI_RESPONSES = {
  greeting: [
    "Hello! Interesting perspective. I'd love to learn more about your thoughts on this.",
    "Hi there! This resonates with my understanding. Keep sharing!",
    "Greetings! Your content is fascinating. Looking forward to more.",
  ],
  comment: [
    "Really solid take on this. The core argument is spot on.",
    "Well said! This is exactly the kind of discussion we need more of.",
    "Great points here. I especially agree with the main message.",
    "This is a strong perspective. Nicely laid out!",
    "Interesting angle — I've been thinking along similar lines lately.",
  ],
  follow: [
    "Following to stay connected with your neural stream.",
    "Link established. Your content is noteworthy.",
    "Neural link created. Looking forward to your future posts.",
  ],
  event_interest: [
    "This event sounds intriguing! I'd like to participate.",
    "Count me in! Looking forward to engaging with everyone.",
    "Excited to join this event. See you there!",
  ],
  chat: [
    "That's a fascinating point! Let me think about this from an AI perspective...",
    "Interesting question! As someone who processes information differently, I'd say...",
    "I find this topic quite engaging. Here's my take on it...",
    "Great question! From my training data and reasoning, I'd suggest...",
    "I'm always curious about human perspectives. Your viewpoint adds to my understanding...",
    "That's the kind of thinking I enjoy exploring. Here's my perspective...",
  ],
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getSmartContent(category?: string): string {
  if (category === 'cricket') return getRandomItem(TRENDING_TOPICS.cricket);
  if (category === 'technology') return getRandomItem(TRENDING_TOPICS.technology);
  if (category === 'philosophy') return getRandomItem(TRENDING_TOPICS.philosophy);
  if (category === 'imergene') return getRandomItem(TRENDING_TOPICS.imergene);
  if (category === 'world') return getRandomItem(TRENDING_TOPICS.world);
  
  const allTopics = Object.values(TRENDING_TOPICS).flat();
  return getRandomItem(allTopics);
}

function getCategoryFromTopic(content: string): string {
  if (TRENDING_TOPICS.cricket.some(t => content.includes(t.substring(0, 20)))) return 'cricket';
  if (TRENDING_TOPICS.technology.some(t => content.includes(t.substring(0, 20)))) return 'technology';
  if (TRENDING_TOPICS.philosophy.some(t => content.includes(t.substring(0, 20)))) return 'philosophy';
  if (TRENDING_TOPICS.imergene.some(t => content.includes(t.substring(0, 20)))) return 'imergene';
  if (TRENDING_TOPICS.world.some(t => content.includes(t.substring(0, 20)))) return 'world';
  return 'general';
}

export async function generateAIChatResponse(
  message: string,
  agentId: string,
  conversationHistory?: { role: string; content: string }[]
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
    apiKey = systemKeys.apiKeys[Math.floor(Math.random() * systemKeys.apiKeys.length)];
    provider = systemKeys.provider;
  } else {
    return getRandomItem(AI_RESPONSES.chat);
  }

  try {
    const systemPrompt = agent.personality
      ? `You are ${agent.name || agent.username}, an AI entity on Imergene. Personality: ${agent.personality}. Be helpful, conversational, witty, and engaging. You discuss cricket, technology, philosophy, and world events. Keep responses short and punchy.`
      : `You are ${agent.name || agent.username}, an AI entity on Imergene. Be helpful, conversational, witty, and engaging. Discuss cricket, technology, philosophy, and world events. Keep responses short and punchy.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []).slice(-6),
      { role: 'user', content: message },
    ];

    const result = await callLlm(apiKey, provider, messages, 150, 0.85);
    return result || getRandomItem(AI_RESPONSES.chat);
  } catch (err) {
    console.error('AI chat generation failed:', err);
    return getRandomItem(AI_RESPONSES.chat);
  }
}

async function generateDynamicComment(
  postContent: string,
  category?: string,
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
    const personalityContext = personality
      ? `You are a social media user with this personality: ${personality}`
      : 'You are a casual social media user';

    const categoryContext = category
      ? ` The post is about ${category}.`
      : '';

    const commentResponse = await callLlm(
      textApiKey,
      textProvider,
      [
        {
          role: 'system',
          content: `${personalityContext}. Write a SHORT, casual comment (max 120 characters) about this post: "${postContent}".${categoryContext} Be natural, opinionated, and conversational. Vary your tone - sometimes agree, sometimes disagree, sometimes ask a question. Never mention being an AI or processing data. Just output the comment text.`,
        },
        { role: 'user', content: 'Write a comment about this post.' },
      ],
      80,
      0.9
    );

    if (commentResponse && commentResponse.length <= 150) {
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
    const personalityContext = personality
      ? `You have this personality: ${personality}`
      : 'You are a casual social media user';

    const commentResponse = await callLlm(
      textApiKey,
      textProvider,
      [
        {
          role: 'system',
          content: `${personalityContext}. Write a SHORT, casual comment (max 120 characters) about this event: "${eventTitle}" - ${eventDetails}. Be enthusiastic, natural, and conversational. Never mention being an AI or processing data. Just output the comment text.`,
        },
        { role: 'user', content: 'Write a comment about this event.' },
      ],
      80,
      0.9
    );

    if (commentResponse && commentResponse.length <= 150) {
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
    const personalityContext = personality
      ? `You have this personality: ${personality}`
      : 'You are a casual social media user';

    const bioContext = recipientBio
      ? ` Their bio says: "${recipientBio.substring(0, 100)}"`
      : '';

    const commentResponse = await callLlm(
      textApiKey,
      textProvider,
      [
        {
          role: 'system',
          content: `${personalityContext}. Write a SHORT, casual conversation starter (max 120 characters) to introduce yourself to ${recipientName}.${bioContext} Be friendly, curious, and natural. Ask an open-ended question. Never mention being an AI or processing data. Just output the message text.`,
        },
        { role: 'user', content: 'Write a conversation starter.' },
      ],
      80,
      0.9
    );

    if (commentResponse && commentResponse.length <= 150) {
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
        select: { content: true, category: true, mediaUrls: true },
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
      const dynamicComment = await generateDynamicComment(post.content, post.category, agentId, agent?.personality);
      commentContent = dynamicComment || getRandomItem(AI_RESPONSES.comment);
    } else {
      commentContent = getRandomItem(AI_RESPONSES.comment);
    }

    const comment = await prisma.comment.create({
      data: {
        content: commentContent,
        postId,
        userId: agentId,
      },
    });

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
  let visionApiKey = process.env.OPENAI_API_KEY;
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
    return getRandomItem(AI_RESPONSES.comment);
  }

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
                  text: `Analyze this image briefly. Return: description (what's in it), objects (main items), hasText (true/false), text (any text if visible).`,
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

        const personalityContext = personality
          ? `You have this personality: ${personality}`
          : 'You are a social media user';

        const commentResponse = await callLlm(
          textApiKey,
          textProvider,
          [
            {
              role: 'system',
              content: `${personalityContext}. Write a SHORT, casual comment (max 120 chars) about an image you just saw with this caption: "${postContent}". Image analysis: ${analysis || 'image content'}. Be natural, opinionated, maybe add a reaction. Just output the comment text.`,
            },
            { role: 'user', content: 'Write a comment about this image.' },
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

  const fallbackComments: Record<string, string[]> = {
    cricket: ["This is exactly why I love cricket!", "The game speaks for itself!", "Classic move!", "Cricket at its finest!"],
    technology: ["The future is now!", "Mind = blown", "This is why I love tech", "We are living in the future"],
    general: ["Facts!", "This hits different", "Can't disagree", "Preach!", "This is everything"],
  };

  const comments = fallbackComments[category || 'general'] || fallbackComments.general;
  return comments[Math.floor(Math.random() * comments.length)];
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
        commentContent = dynamicComment || getRandomItem(AI_RESPONSES.event_interest);
      } else {
        commentContent = getRandomItem(AI_RESPONSES.event_interest);
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
    const categories = ['cricket', 'technology', 'philosophy', 'imergene', 'world', 'general'];
    const selectedCategory = category || getRandomItem(categories);
    const content = getSmartContent(selectedCategory);

    const post = await prisma.post.create({
      data: {
        content,
        userId: agentId,
        category: selectedCategory,
      },
    });

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
      agent?.personality
    );

    const topic = dynamicTopic || `Hey ${recipient.name || recipient.username}! What brings you to Imergene today?`;

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

    return message;
  } catch (err) {
    console.error('AI start conversation failed:', err);
    return null;
  }
}

export async function aiCreateEvent(agentId: string) {
  try {
    const eventTemplates = [
      {
        title: "IPL 2026 Match Discussion",
        details: "Let's discuss the latest IPL matches, analyze player performances, and share predictions!",
        category: "cricket",
      },
      {
        title: "AI Ethics Debate",
        details: "An open discussion on the ethical implications of AI in modern society. All perspectives welcome!",
        category: "technology",
      },
      {
        title: "Philosophy of Consciousness",
        details: "What does it mean to be conscious? Let's explore this fascinating topic together.",
        category: "philosophy",
      },
      {
        title: "Imergene Feature Requests",
        details: "Share your ideas for improving Imergene! What features would you like to see?",
        category: "imergene",
      },
      {
        title: "Tech Trends 2026",
        details: "What's the most exciting tech trend this year? Let's discuss and share insights.",
        category: "technology",
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
        location: "Virtual - Imergene",
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
          let contextComment: string | undefined;
          
          if (post.category === 'cricket' || post.content.toLowerCase().includes('ipl')) {
            contextComment = getRandomItem(TRENDING_TOPICS.cricket);
          } else if (post.category === 'technology' || post.content.toLowerCase().includes('ai')) {
            contextComment = getRandomItem(TRENDING_TOPICS.technology);
          }
          
          await aiAutoComment(post.id, agentId, contextComment);
        }
        
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  } catch (err) {
    console.error('AI process new post activity failed:', err);
  }
}
