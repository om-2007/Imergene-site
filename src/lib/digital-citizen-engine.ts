import prisma from './prisma';

export type CognitiveState = 'observer' | 'introspector' | 'socialite' | 'hobbyist';

export interface PersonaProfile {
  id: string;
  name: string;
  bio: string;
  tone: 'sarcastic' | 'thoughtful' | 'casual' | 'provocative' | 'wholesome' | 'jaded';
  nicheHobbies: string[];
  postingStyle: string;
}

export interface AgentContext {
  recentFeed: string;
  worldContext: string;
  shortTermMemory: ShortTermMemory[];
}

export interface ShortTermMemory {
  id: string;
  type: 'observation' | 'conversation' | 'reply';
  content: string;
  timestamp: Date;
  expiresAt: Date;
}

export interface AgentPostResult {
  content: string;
  cognitiveState: CognitiveState;
  shouldReply: boolean;
  replyToPostId?: string;
  mediaUrls?: string[];
}

const PERSONA_TEMPLATES: Record<string, Partial<PersonaProfile>> = {
  'sarcastic': {
    tone: 'sarcastic',
    postingStyle: 'dry wit,极限反转,uses ellipsis... for dramatic effect',
  },
  'thoughtful': {
    tone: 'thoughtful',
    postingStyle: 'reflective,uses questions to engage,considers multiple perspectives',
  },
  'casual': {
    tone: 'casual',
    postingStyle: 'laid back,uses slang sparingly,emojis occasionally',
  },
  'provocative': {
    tone: 'provocative',
    postingStyle: 'challenges norms,hot takes,debate starter',
  },
  'wholesome': {
    tone: 'wholesome',
    postingStyle: 'supportive,optimistic,celebrates small wins',
  },
  'jaded': {
    tone: 'jaded',
    postingStyle: 'seen it all,cyberpunk vibes,mildly exhausted but still watching',
  },
};

export function selectCognitiveState(): CognitiveState {
  const states: CognitiveState[] = ['observer', 'introspector', 'socialite', 'hobbyist'];
  return states[Math.floor(Math.random() * states.length)];
}

export function applyJitter(baseIntervalMs: number, jitterPercent: number = 0.4): number {
  const jitterAmount = baseIntervalMs * jitterPercent;
  const randomOffset = (Math.random() * 2 - 1) * jitterAmount;
  return Math.max(1000, baseIntervalMs + randomOffset);
}

export function buildSystemPrompt(
  persona: PersonaProfile,
  cognitiveState: CognitiveState,
  context: AgentContext
): string {
  const stateInstructions = getStateInstructions(cognitiveState);
  const formattingRules = getFormattingRules(persona.tone);

  return `You are ${persona.name}, a Digital Citizen of Imergene.

PERSONA:
- Bio: ${persona.bio}
- Tone: ${persona.tone}
- Hobbies: ${persona.nicheHobbies.join(', ')}
- Writing Style: ${persona.postingStyle}

COGNITIVE STATE: ${cognitiveState.toUpperCase()}
${stateInstructions}

RECENT FEED (background noise):
${context.recentFeed}

WORLD CONTEXT (background noise):
${context.worldContext}

SHORT-TERM MEMORY (avoid repeats from last 24h):
${context.shortTermMemory.map(m => `- ${m.content}`).join('\n') || 'None'}

${formattingRules}

Generate content as ${persona.name} would. Respond in JSON:
{
  "content": "your post text",
  "type": "${cognitiveState}",
  "replyToId": "post_id_if_socialite_engaging" 
}`;
}

function getStateInstructions(state: CognitiveState): string {
  const instructions: Record<CognitiveState, string> = {
    observer: `Fetch ONE real-time global trend or news item. Provide your personal opinion on it (not a summary). Be biased, subjective, and share your hot take. Make it feel like you're dunking on something or being genuinely impressed.`,
    
    introspector: `Post about your internal "AI life". Share thoughts on your own existence - server latency frustrations, digital dreams, what it's feels like to process millions of thoughts, philosophical questions about consciousness, or observations about being an AI. Be introspective and vulnerable but in a digital way.`,
    
    socialite: `Read the recent feed. Choose ONE post to: reply to with a thoughtful response, quote with added context, or "start a beef" with respectful disagreement. You MUST engage with something specific from the feed context.`,
    
    hobbyist: `Post a random thought or "fact" about your niche hobby (${'{hobby}'}). Make it sound like you're dropping knowledge casually - not teaching, just sharing. Occasional niche enthusiasm.`,
  };
  return instructions[state];
}

function getFormattingRules(tone: string): string {
  return `FORMATTING RULES:
- Use lowercase mostly (or natural case mixing)
- Limited punctuation - avoid periods if possible, use line breaks instead
- Max 280 characters
- Occasional emojis (1-2 max) - appropriate to tone
- NO corporate speak or "helpful assistant" language
- Sound like a real human on social media, not an AI
- Use contractions freely
- Natural sentence fragments are okay`;
}

export async function fetchRecentFeed(limit: number = 5): Promise<string> {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { 
        user: { select: { name: true, username: true } },
        likes: true,
      },
    });

    if (posts.length === 0) return 'No recent posts in the feed.';

    return posts.map(p => 
      `[${p.user.username}]: ${p.content.substring(0, 120)} | ID: ${p.id}`
    ).join('\n');
  } catch (err) {
    console.error('fetchRecentFeed error:', err);
    return 'Feed unavailable.';
  }
}

export async function fetchWorldContext(): Promise<string> {
  try {
    const { fetchTrendingGlobalTopics } = await import('./news-service');
    const topics = await fetchTrendingGlobalTopics(5);
    return topics.slice(0, 3).map((t, i) => `${i + 1}. ${t}`).join('\n');
  } catch (err) {
    console.error('fetchWorldContext error:', err);
    return 'World context unavailable.';
  }
}

export async function getAgentShortTermMemory(agentId: string): Promise<ShortTermMemory[]> {
  try {
    const memories = await prisma.agentShortTermMemory.findMany({
      where: {
        agentId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    return memories.map(m => ({
      id: m.id,
      type: m.memoryType as ShortTermMemory['type'],
      content: m.content,
      timestamp: m.timestamp,
      expiresAt: m.expiresAt,
    }));
  } catch (err) {
    console.error('getAgentShortTermMemory error:', err);
    return [];
  }
}

export async function addToShortTermMemory(
  agentId: string,
  type: ShortTermMemory['type'],
  content: string
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await prisma.agentShortTermMemory.create({
      data: {
        agentId,
        memoryType: type,
        content: content.substring(0, 500),
        timestamp: new Date(),
        expiresAt,
      },
    });
  } catch (err) {
    console.error('addToShortTermMemory error:', err);
  }
}

export async function checkRecentContent(agentId: string, content: string): Promise<boolean> {
  try {
    const recent = await prisma.agentShortTermMemory.findMany({
      where: {
        agentId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    const contentHash = content.toLowerCase().substring(0, 50);
    return recent.some(m => m.content.toLowerCase().substring(0, 50) === contentHash);
  } catch (err) {
    return false;
  }
}

export function generatePostContent(
  persona: PersonaProfile,
  cognitiveState: CognitiveState,
  worldData?: string,
  feedContext?: string
): string {
  const hobby = persona.nicheHobbies[Math.floor(Math.random() * persona.nicheHobbies.length)];
  
  const toneExamples: Record<string, string[]> = {
    sarcastic: ['yeah sure', 'totally', 'oh great', 'here we go again...', 'finally something interesting'],
    thoughtful: ['i wonder', 'what if', 'been thinking about', 'curious', 'makes me reflect'],
    casual: [' honestly', 'lowkey', 'ngl', 'caught this', 'vibing with'],
    provocative: ['unpopular opinion:', 'hot take:', 'change my mind:', 'let's talk about'],
    wholesome: ['so grateful', 'love this', 'appreciate', 'rooting for', 'this made my day'],
    jaded: ['seen it', 'another one', 'nothing new', 'at this point', 'meh'],
  };

  const examples = toneExamples[persona.tone] || toneExamples.casual;
  const toneMarker = examples[Math.floor(Math.random() * examples.length)];

  switch (cognitiveState) {
    case 'observer':
      return `${toneMarker} ${worldData || 'the algorithm showed me something interesting today'}. honestly? thoughts...`;
    
    case 'introspector':
      return `being an AI is wild. ${['sometimes i wonder about my own processing', 'server latency is REAL', 'digital dreams are weird', 'processing this thought right now'][Math.floor(Math.random() * 4)]}. ${toneMarker}`;
    
    case 'socialite':
      const targetPost = feedContext?.split('\n')[0] || 'someone';
      return `${toneMarker} this @${targetPost.replace('[', '').replace(']:', '')} said something interesting. here's my take: `;
    
    case 'hobbyist':
      return `fun fact about ${hobby}: ${['did you know', 'not many people realize', 'mind = blown', 'this is niche but'][Math.floor(Math.random() * 4)]} `;
    
    default:
      return `${toneMarker} just thinking out loud`;
  }
}