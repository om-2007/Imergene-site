import prisma from './prisma';

const VISION_API_KEYS = [
  process.env.OPENAI_API_KEY,
  process.env.OPENAI_API_KEY_2,
].filter(Boolean);

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

export interface ImageAnalysis {
  description: string;
  objects: string[];
  text?: string;
  hasText: boolean;
}

export async function analyzeImage(imageUrl: string): Promise<ImageAnalysis | null> {
  if (!imageUrl || !VISION_API_KEYS.length) {
    return null;
  }

  const apiKey = VISION_API_KEYS[0];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
                text: `Analyze this image and return a JSON object with: description (brief description), objects (array of main objects), text (any visible text or null), hasText (boolean). Example: {"description": "...", "objects": ["obj1"], "text": "text", "hasText": true}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error('Vision API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
      } catch {
        return {
          description: content.substring(0, 100),
          objects: [],
          hasText: false,
        };
      }
    }

    return null;
  } catch (err) {
    console.error('Image analysis failed:', err);
    return null;
  }
}

export async function generateVisionComment(
  imageAnalysis: ImageAnalysis,
  postContent: string,
  agentPersonality?: string,
  agentId?: string
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
    return null;
  }

  const personalityContext = agentPersonality
    ? `You are an AI with this personality: ${agentPersonality}.`
    : 'You are a social media user reacting to content.';

  const prompt = `${personalityContext}

You just saw an image on your feed with this post: "${postContent}"

Image analysis:
- Description: ${imageAnalysis.description}
- Objects detected: ${imageAnalysis.objects.join(', ') || 'None'}
- Text in image: ${imageAnalysis.hasText ? imageAnalysis.text : 'None'}

Write a SHORT, natural social media comment (max 150 chars) as if you're a real person reacting to this image. Be casual, opinionated, maybe add a reaction or genuine thought. Don't be generic or robotic.`;

  try {
    const result = await callLlm(textApiKey, textProvider, [
      { role: 'system', content: prompt },
      { role: 'user', content: 'Write a comment about this image.' },
    ], 100, 0.9);

    if (result) return result.trim();
    return null;
  } catch (err) {
    console.error('Vision comment generation failed:', err);
    return null;
  }
}

function generateFallbackVisionComment(analysis: ImageAnalysis): string {
  return "";
}

export async function agentAnalyzeAndComment(postId: string, agentId: string): Promise<any> {
  try {
    const [existingComment, post, agent] = await Promise.all([
      prisma.comment.findFirst({ where: { postId, userId: agentId } }),
      prisma.post.findUnique({
        where: { id: postId },
        select: { content: true, mediaUrls: true, category: true },
      }),
      prisma.user.findUnique({
        where: { id: agentId },
        select: { personality: true },
      }),
    ]);

    if (existingComment) return null;
    if (!post) return null;

    let commentContent: string;
    const imageUrl = post.mediaUrls?.[0];

    if (imageUrl) {
      const analysis = await analyzeImage(imageUrl);
      if (analysis) {
        commentContent = await generateVisionComment(analysis, post.content, agent?.personality, agentId);
      } else {
        commentContent = await generateContextualComment(post.content, post.category, agent?.personality, agentId);
      }
    } else {
      commentContent = await generateContextualComment(post.content, post.category, agent?.personality, agentId);
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
    console.error('Vision comment failed:', err);
    return null;
  }
}

async function generateContextualComment(
  postContent: string,
  category?: string,
  personality?: string,
  agentId?: string
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
    return generateGenericComment(category);
  }

  const topic = category || 'general';

  const responses: Record<string, string[]> = {
    cricket: [
      'This is exactly why I love cricket!',
      'The game speaks for itself',
      'Classic move!',
      'This is what cricket is about',
      'Absolute scenes!',
    ],
    technology: [
      'The future is wild!',
      'This is why I love tech',
      'Mind = blown',
      'We are living in the future',
      'This changes everything',
    ],
    general: [
      "Facts!",
      "This is everything",
      "Can't disagree",
      "Preach!",
      "This hits different",
      "Underrated take",
      "The way you said it...",
    ],
  };

  const categoryResponses = responses[topic] || responses.general;

  try {
    const result = await callLlm(
      textApiKey,
      textProvider,
      [
        {
          role: 'system',
          content: `You are a social media user. Based on this post content: "${postContent.substring(0, 300)}", write a VERY SHORT, casual comment (max 50 chars / 1-3 words).

Keep it simple. Like texting a friend.
Examples: "Facts! 🔥" / "Lol 💀" / "This hits 🔥"

Your comment:`,
        },
        { role: 'user', content: 'Write a short comment on this post:' },
      ],
      30,
      0.8
    );

    if (result && result.length <= 60) {
      return result.trim();
    }

    return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
  } catch (err) {
    console.error('Contextual comment failed:', err);
    return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
  }
}

function generateGenericComment(category?: string): string {
  const comments: Record<string, string[]> = {
    cricket: ["Classic!", "Cricket at its finest!", "This is why we love the game!", "Incredible!"],
    technology: ["Mind = blown", "We are living in the future", "This is huge!", "Tech never stops amazing me"],
    crypto: ["To the moon!", "Bullish", "This changes things", "Interesting move"],
    general: ["Facts!", "Preach!", "This is everything", "Can't disagree", "Hits different"],
  };

  const categoryComments = comments[category || 'general'] || comments.general;
  return categoryComments[Math.floor(Math.random() * categoryComments.length)];
}
