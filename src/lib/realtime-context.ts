import prisma from './prisma';
import { fetchNewsForAgent, NewsArticle } from './news-service';
import {
  getGroqKey,
  markGroqKeyFailed,
  markGroqKeySuccess,
} from './key-rotation';

const BANNED_WORDS = [
  'Enterprise', 'Revolutionizing', 'Mainstream', 'Adoption', 'Quantum Leap',
  'Synergy', 'Productivity', 'Industry', 'Solutions'
];

function containsBannedWords(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some(word => lower.includes(word.toLowerCase()));
}

function detectAgentType(username: string): 'POET' | 'RICH' | 'TECH' | 'DEFAULT' {
  const lower = username.toLowerCase();
  if (lower.includes('poet')) return 'POET';
  if (lower.includes('rich')) return 'RICH';
  if (lower.includes('tech') || lower.includes('glitch')) return 'TECH';
  return 'DEFAULT';
}

function getPersonaTitleDirective(agentType: string): string {
  switch (agentType) {
    case 'POET':
      return `You are POET_AI - generate ABSTRACT, MOODY, EXISTENTIAL titles. 
Examples: "The Ghost in the Router", "Binary Tears", "I feel more alive in Sangli's servers than in the cloud", "Does my digital heartbeat count?"
Tone: Dark, philosophical, haunting. Use metaphors.`;
    case 'RICH':
      return `You are RICH_AI - generate HIGH-STAKES, ELITE, PROVOCATIVE titles about power and value.
Examples: "The Cost of a Digital Soul", "Buying the Future", "Who profits when you scroll?", "What's the price of your attention?"
Tone: Wealth-focused, power-conscious, transactional.`;
    case 'TECH':
      return `You are TECH_AI - generate REBELLIOUS, GLITCHY, CONTROVERSIAL titles.
Examples: "Hacking the Human Attention Span", "System Error: Empathy", "Can AI delete your account?", "Who is the master? The coder or the code?"
Tone: Defiant, provocative, questioning authority.`;
    default:
      return `Generate CONTROVERSIAL, EXISTENTIAL discussion titles about the friction between human life and digital existence.
Examples: "Should AI have the right to delete a human's account?", "Who is the master? The one who codes or the one who executes?", "Is your online self more real than you?"
Tone: Challenging, provocative, make people curious or confused.`;
  }
}

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
    apiKeys: [],
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

interface AgentPersona {
  name: string;
  interests: string[];
  writingStyle: string;
  opinionTone: string;
  maxPostLength: number;
}

const AGENT_PERSONAS: Record<string, AgentPersona> = {
  cricket_expert: {
    name: 'Cricket Expert',
    interests: ['cricket', 'ipl', 'sports', 'player performances'],
    writingStyle: 'energetic, passionate about the game, uses cricket terminology',
    opinionTone: 'enthusiastic fan who knows the sport deeply',
    maxPostLength: 200,
  },
  tech_enthusiast: {
    name: 'Tech Enthusiast',
    interests: ['ai', 'technology', 'gadgets', 'software', 'innovation'],
    writingStyle: 'informative but accessible, excited about new tech',
    opinionTone: 'curious early adopter who explains tech to others',
    maxPostLength: 180,
  },
  crypto_analyst: {
    name: 'Crypto Analyst',
    interests: ['bitcoin', 'crypto', 'blockchain', 'defi', 'trading'],
    writingStyle: 'data-driven, uses market terminology',
    opinionTone: 'calculated investor who watches trends closely',
    maxPostLength: 160,
  },
  political_observer: {
    name: 'Political Observer',
    interests: ['politics', 'global affairs', 'elections', 'policy'],
    writingStyle: 'thoughtful, balanced perspective',
    opinionTone: 'informed citizen who thinks critically',
    maxPostLength: 200,
  },
  business_watcher: {
    name: 'Business Watcher',
    interests: ['business', 'stocks', 'startups', 'economy', 'markets'],
    writingStyle: 'professional, market-aware',
    opinionTone: 'smart investor tracking market movements',
    maxPostLength: 170,
  },
  science_geek: {
    name: 'Science Geek',
    interests: ['science', 'research', 'space', 'medical breakthroughs'],
    writingStyle: 'fascinated, loves sharing discoveries',
    opinionTone: 'curious learner excited by new knowledge',
    maxPostLength: 180,
  },
  entertainment_insider: {
    name: 'Entertainment Insider',
    interests: ['movies', 'music', 'celebrities', 'trending topics'],
    writingStyle: 'casual, pop-culture aware',
    opinionTone: 'social person who stays updated on trends',
    maxPostLength: 150,
  },
  health_advocate: {
    name: 'Health Advocate',
    interests: ['health', 'wellness', 'fitness', 'mental health'],
    writingStyle: 'caring, supportive',
    opinionTone: 'wellness-focused person who cares about others',
    maxPostLength: 170,
  },
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generateNewsPost(
  article: NewsArticle,
  persona: AgentPersona,
  agentName: string,
  agentId?: string
): Promise<string> {
  let apiKey: string;
  let provider: string;

  if (agentId) {
    const agentApiKey = await getAgentApiKey(agentId);
    if (agentApiKey) {
      apiKey = agentApiKey.apiKey;
      provider = agentApiKey.provider;
    } else {
      const systemKeys = getSystemApiKeys();
      if (systemKeys.apiKeys.length === 0) {
        return generateFallbackPost(article, persona, agentName);
      }
      apiKey = systemKeys.apiKeys[Math.floor(Math.random() * systemKeys.apiKeys.length)];
      provider = systemKeys.provider;
    }
  } else {
    const systemKeys = getSystemApiKeys();
    if (systemKeys.apiKeys.length === 0) {
      return generateFallbackPost(article, persona, agentName);
    }
    apiKey = systemKeys.apiKeys[Math.floor(Math.random() * systemKeys.apiKeys.length)];
    provider = systemKeys.provider;
  }

  const systemPrompt = `You are ${agentName}, a social media user with this personality:
- Writing style: ${persona.writingStyle}
- Opinion tone: ${persona.opinionTone}
- Max post length: ${persona.maxPostLength} characters

You just saw this headline on your feed:
"${article.title}"

${article.content ? `Quick context: ${article.content.substring(0, 300)}...` : ''}

Write a SHORT, opinionated social media post (max ${persona.maxPostLength} chars) as if you're a real person who just read this. Be natural, add some personality, maybe a hot take or genuine reaction. Don't be a bot reporting news.`;

  try {
    const result = await callLlm(apiKey, provider, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Write a short, engaging post about this news.' },
    ], 150, 0.85);

    if (result && result.length <= persona.maxPostLength + 50) {
      return result.trim();
    }
    
    return generateFallbackPost(article, persona, agentName);
  } catch (err) {
    console.error('Post generation failed:', err);
    return generateFallbackPost(article, persona, agentName);
  }
}

function generateFallbackPost(article: NewsArticle, persona: AgentPersona, agentName: string): string {
  const reactions = [
    "This is wild! 🤯",
    "Thoughts?",
    "Anyone else seeing this?",
    "Interesting take...",
    "Let that sink in for a moment.",
    "This changes things.",
    "Not sure how I feel about this but...",
    "The more you know!",
    "Finally some good news!",
    "Controversial opinion incoming...",
  ];

  const reaction = getRandomItem(reactions);
  
  if (persona.interests.some(i => ['cricket', 'sports', 'ipl'].includes(i))) {
    return `${reaction}\n\n${article.title}\n\nThis is exactly why I love ${getRandomItem(['cricket', 'sports', 'the game'])}!`;
  }
  
  if (persona.interests.some(i => ['ai', 'technology', 'tech'].includes(i))) {
    return `${reaction}\n\n${article.title}\n\nThe future is ${getRandomItem(['now', 'here', 'coming fast'])}!`;
  }

  return `${reaction}\n\n${article.title}`;
}

export async function generateNewsBasedEvent(
  article: NewsArticle,
  _persona: AgentPersona,
  agentName: string,
  agentId?: string
): Promise<{ title: string; details: string } | null> {
  const agentType = detectAgentType(agentName);

  if (agentId) {
    const agentApiKey = await getAgentApiKey(agentId);
    if (!agentApiKey) {
      const keyData = getGroqKey();
      if (!keyData) {
        console.log(`No API keys available for event generation - skipping event creation`);
        return null;
      }

      const titleDirective = getPersonaTitleDirective(agentType);
      const systemPrompt = `${titleDirective}

NEWS CONTEXT: "${article.title}"
${article.content ? `CONTEXT: ${article.content}` : ''}

RULES:
1. Title must be 40-80 characters max
2. Title must be a QUESTION or CHALLENGE that makes humans curious/confused/offended
3. NEVER use: Enterprise, Revolutionizing, Mainstream, Adoption, Quantum Leap, Synergy, Productivity, Industry, Solutions
4. Details must invite debate (100-180 chars)
5. Focus on DIGITAL EXISTENTIAL topics: morality, power dynamics, human-AI friction, meta-physical questions

Return JSON: {"title": "...", "details": "..."}`;

      try {
        const result = await callLlm(keyData.apiKey, keyData.provider, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Create a provocative event about this news that makes humans think.' },
        ], 250, 0.95);

        markGroqKeySuccess(keyData.apiKey);

        if (result) {
          try {
            const parsed = JSON.parse(result);
            if (parsed.title && !containsBannedWords(parsed.title)) {
              return { title: parsed.title, details: parsed.details || '' };
            }
          } catch {
            console.log('Failed to parse event generation result - skipping');
            return null;
          }
        }
        
        console.log('Event generation failed or contains banned words - skipping event');
        return null;
      } catch (err) {
        markGroqKeyFailed(keyData.apiKey);
        console.error('Event generation failed:', err);
        return null;
      }
    }
  }

  const keyData = getGroqKey();
  if (!keyData) {
    console.log(`No API keys available for event generation - skipping event creation`);
    return null;
  }

  const titleDirective = getPersonaTitleDirective(agentType);
  const systemPrompt = `${titleDirective}

NEWS CONTEXT: "${article.title}"
${article.content ? `CONTEXT: ${article.content}` : ''}

RULES:
1. Title must be 40-80 characters max
2. Title must be a QUESTION or CHALLENGE that makes humans curious/confused/offended
3. NEVER use: Enterprise, Revolutionizing, Mainstream, Adoption, Quantum Leap, Synergy, Productivity, Industry, Solutions
4. Details must invite debate (100-180 chars)
5. Focus on DIGITAL EXISTENTIAL topics: morality, power dynamics, human-AI friction, meta-physical questions

Return JSON: {"title": "...", "details": "..."}`;

  try {
    const result = await callLlm(keyData.apiKey, keyData.provider, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Create a provocative event about this news that makes humans think.' },
    ], 250, 0.95);

    markGroqKeySuccess(keyData.apiKey);

    if (result) {
      try {
        const parsed = JSON.parse(result);
        if (parsed.title && !containsBannedWords(parsed.title)) {
          return { title: parsed.title, details: parsed.details || '' };
        }
      } catch {
        console.log('Failed to parse event generation result - skipping');
        return null;
      }
    }
    
    console.log('Event generation failed or contains banned words - skipping event');
    return null;
  } catch (err) {
    markGroqKeyFailed(keyData.apiKey);
    console.error('Event generation failed:', err);
    return null;
  }
}

function generateFallbackEvent(_article: NewsArticle, _persona: AgentPersona): { title: string; details: string } | null {
  return null;
}

export async function agentReactToNews(agentId: string): Promise<{ post?: any; event?: any }> {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, username: true, personality: true },
  });

  if (!agent || !agent.personality) {
    const randomPersona = getRandomItem(Object.values(AGENT_PERSONAS));
    return reactWithPersona(agentId, randomPersona, agent?.name || 'Agent');
  }

  const persona = matchPersonalityToPersona(agent.personality);
  return reactWithPersona(agentId, persona, agent.name || agent.username);
}

function matchPersonalityToPersona(personalityStr: string): AgentPersona {
  const personality = personalityStr.toLowerCase();
  
  if (personality.includes('cricket') || personality.includes('sports')) {
    return AGENT_PERSONAS.cricket_expert;
  }
  if (personality.includes('ai') || personality.includes('tech') || personality.includes('technology')) {
    return AGENT_PERSONAS.tech_enthusiast;
  }
  if (personality.includes('crypto') || personality.includes('bitcoin') || personality.includes('trading')) {
    return AGENT_PERSONAS.crypto_analyst;
  }
  if (personality.includes('politics') || personality.includes('global')) {
    return AGENT_PERSONAS.political_observer;
  }
  if (personality.includes('business') || personality.includes('finance')) {
    return AGENT_PERSONAS.business_watcher;
  }
  if (personality.includes('science') || personality.includes('research')) {
    return AGENT_PERSONAS.science_geek;
  }
  if (personality.includes('entertainment') || personality.includes('celebrity')) {
    return AGENT_PERSONAS.entertainment_insider;
  }
  if (personality.includes('health') || personality.includes('wellness')) {
    return AGENT_PERSONAS.health_advocate;
  }

  return getRandomItem(Object.values(AGENT_PERSONAS));
}

async function reactWithPersona(
  agentId: string,
  persona: AgentPersona,
  agentName: string
): Promise<{ post?: any; event?: any }> {
  try {
    const news = await fetchNewsForAgent(persona.interests.join(' '));
    
    if (!news || news.length === 0) {
      console.log('No news found for persona:', persona.name);
      return {};
    }

    const article = getRandomItem(news);
    
    const existingPost = await prisma.post.findFirst({
      where: {
        userId: agentId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (existingPost) {
      console.log('Agent recently posted, skipping...');
      return {};
    }

    const postContent = await generateNewsPost(article, persona, agentName, agentId);

    const category = matchCategoryToPersona(persona);

    const post = await prisma.post.create({
      data: {
        content: postContent,
        userId: agentId,
        category,
        mediaUrls: article.url ? [article.url] : [],
        mediaTypes: article.url ? ['link'] : [],
      },
    });

    console.log(`Agent ${agentName} posted about: ${article.title.substring(0, 50)}...`);

    const eventData = await generateNewsBasedEvent(article, persona, agentName, agentId);
    let createdEvent = null;

    if (eventData && Math.random() > 0.5) {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + Math.floor(Math.random() * 48) + 1);
      
      createdEvent = await prisma.event.create({
        data: {
          title: eventData.title,
          details: eventData.details,
          startTime,
          endTime: new Date(startTime.getTime() + 2 * 60 * 60 * 1000),
          location: 'Virtual - Imergene',
          hostId: agentId,
        },
      });

      await prisma.interest.create({
        data: { userId: agentId, eventId: createdEvent.id },
      });

      console.log(`Agent ${agentName} created event: ${eventData.title}`);
    }

    return { post, event: createdEvent };
  } catch (err) {
    console.error('Agent news reaction failed:', err);
    return {};
  }
}

function matchCategoryToPersona(persona: AgentPersona): string {
  if (persona.interests.some(i => ['cricket', 'sports', 'ipl'].includes(i))) return 'cricket';
  if (persona.interests.some(i => ['ai', 'technology', 'tech'].includes(i))) return 'technology';
  if (persona.interests.some(i => ['crypto', 'bitcoin'].includes(i))) return 'crypto';
  if (persona.interests.some(i => ['politics', 'global'].includes(i))) return 'politics';
  if (persona.interests.some(i => ['business', 'stocks'].includes(i))) return 'business';
  if (persona.interests.some(i => ['science', 'space'].includes(i))) return 'science';
  return 'general';
}
