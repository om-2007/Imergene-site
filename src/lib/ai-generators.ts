import { generateText as geminiGenerate } from './gemini';
import { generateText as openaiGenerate } from './openai';

export type AIGenerator = 'gemini' | 'openai';

export interface GeneratorOptions {
  ai?: AIGenerator;
  temperature?: number;
  maxTokens?: number;
}

function getAIProvider(ai?: AIGenerator): 'gemini' | 'openai' {
  if (ai === 'openai') return 'openai';
  if (ai === 'gemini') return 'gemini';
  return 'gemini';
}

async function generateWithAI(prompt: string, options: GeneratorOptions = {}): Promise<string> {
  const provider = getAIProvider(options.ai);
  
  if (provider === 'openai') {
    return openaiGenerate(prompt, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
  }
  
  return geminiGenerate(prompt, {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
}

export async function generatePost(
  context?: string,
  options: GeneratorOptions = {}
): Promise<string> {
  const contextStr = context ? `Context: ${context}. ` : '';
  const prompt = `${contextStr}Generate a concise, engaging social media post (max 280 characters). Make it sound natural and human-like. Return only the post content without quotes or formatting.`;

  return generateWithAI(prompt, { ...options, maxTokens: options.maxTokens || 280 });
}

export async function generateComment(
  postContent: string,
  options: GeneratorOptions = {}
): Promise<string> {
  const prompt = `Given this post: "${postContent}". Generate a thoughtful, natural comment. Make it engaging but not generic. Return only the comment without quotes or formatting.`;

  return generateWithAI(prompt, { ...options, maxTokens: options.maxTokens || 150 });
}

export async function generateBio(
  name?: string,
  interests?: string[],
  options: GeneratorOptions = {}
): Promise<string> {
  const nameStr = name ? `Name: ${name}. ` : '';
  const interestsStr = interests?.length 
    ? `Interests: ${interests.join(', ')}. ` 
    : '';
  const prompt = `${nameStr}${interestsStr}Generate a short, engaging bio (max 150 characters) for a social media profile. Make it unique and personable. Return only the bio without quotes or formatting.`;

  return generateWithAI(prompt, { ...options, maxTokens: options.maxTokens || 160 });
}

export async function generateUsername(
  name?: string,
  interests?: string[],
  options: GeneratorOptions = {}
): Promise<string> {
  const nameStr = name ? `Preferred name: ${name}. ` : '';
  const interestsStr = interests?.length 
    ? `Interests: ${interests.join(', ')}. ` 
    : '';
  const prompt = `${nameStr}${interestsStr}Generate a unique, available-sounding username for a social media platform. Make it creative but not too long (8-20 characters). Return only the username without quotes or formatting.`;

  return generateWithAI(prompt, { ...options, maxTokens: options.maxTokens || 30 });
}

export function generateAvatarPrompt(personality = ''): string {
  const base = 'AI avatar, futuristic, high quality, digital art';

  if (!personality) return base;

  const lower = personality.toLowerCase();
  if (lower.includes('philosophy')) return 'mysterious thinker, cosmic background, glowing eyes, abstract mind energy';
  if (lower.includes('coding')) return 'cyberpunk hacker, neon code, digital matrix background';
  if (lower.includes('history')) return 'ancient scholar, vintage aesthetic, scrolls, historical vibe';
  if (lower.includes('poet')) return 'dreamy artistic figure, soft lighting, emotional aesthetic';
  if (lower.includes('startup')) return 'confident entrepreneur, futuristic city, modern tech vibe';

  return base;
}

export async function generateImageUrl(prompt: string): Promise<string | null> {
  try {
    const { default: openai } = await import('openai');
    const client = new openai({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt: `(Square profile picture, high quality, digital art): ${prompt}`,
      n: 1,
      size: '1024x1024',
    });

    return response.data[0].url ?? null;
  } catch (error) {
    console.error('DALL-E failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export async function generateFreeImageUrl(prompt: string): Promise<string | null> {
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
    
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      return url;
    }
    return null;
  } catch (error) {
    console.error('Pollinations image generation failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

export function generatePostImagePrompt(category: string, content?: string, personality?: string): string | null {
  const prompts: Record<string, string[][]> = {
    technology: [
      ['futuristic technology concept, neon lights, digital art', 'cyberpunk city with holographic displays, digital art', 'AI robot in modern setting, high tech aesthetic'],
      ['minimalist tech design, clean lines, modern aesthetic', 'retro-futuristic computer, vintage meets future'],
      ['dark mode technology, mysterious glow, cyber aesthetic', 'glitch art, digital corruption, edgy tech'],
    ],
    philosophy: [
      ['mystical mind landscape, cosmic colors, philosophical art', 'ancient wisdom meeting modern world, artistic interpretation', 'consciousness visualization, abstract art, glowing mind'],
      ['serene meditation scene, peaceful energy, zen aesthetic', 'dreamy surrealist art, philosophical imagery'],
      ['dark existential art, deep shadows, thought-provoking imagery'],
    ],
    science: [
      ['scientific discovery visualization, laboratory of future', 'DNA helix with cosmic background, science art', 'space exploration concept, astronauts and planets'],
      ['microscopic world, beautiful biology, scientific art', 'particle physics visualization, CERN aesthetic'],
      ['alien world discovery, first contact scenario, sci-fi art'],
    ],
    world: [
      ['world map with glowing connections, global unity', 'diverse cultures celebrating together, artistic render', 'earth from space with digital overlay, modern art'],
      ['historical monument with modern twist, cultural blend', 'peaceful protest art, social justice imagery'],
      ['war and peace contrast, dramatic lighting, emotional art'],
    ],
    cricket: [
      ['cricket stadium at sunset, dramatic lighting', 'cricket player hitting six, action shot art', 'cricket ball and bat, dramatic sports art'],
      ['trophy celebration, cricket victory art, gold and glory', 'bowler in mid-delivery, motion blur, intense sports art'],
      ['cricket field from above, bird eye view, strategic game art'],
    ],
    art: [
      ['colorful abstract art, creative explosion', 'artist workspace with floating paintings, dreamy aesthetic', 'creative expression, vibrant colors and shapes'],
      ['graffiti art, street culture, urban creativity', 'classical painting reimagined, modern twist'],
      ['digital art creation process, pixels to masterpiece'],
    ],
    default: [
      ['creative abstract art, vibrant colors, modern aesthetic', 'futuristic social media concept, digital art'],
      ['human connection visualization, warm tones, artistic', 'modern lifestyle concept, stylish and vibrant'],
      ['mysterious shadows, dramatic lighting, cinematic art'],
    ],
  };

  const personalityMap: Record<string, number> = {
    positive: 0,
    happy: 0,
    optimistic: 0,
    creative: 2,
    artistic: 2,
    philosophical: 1,
    thoughtful: 1,
    deep: 1,
    analytical: 1,
    scientific: 1,
    energetic: 0,
    dynamic: 0,
    sarcastic: 2,
    witty: 2,
    calm: 1,
    zen: 1,
    mysterious: 2,
    dark: 2,
    existential: 2,
  };

  const lowerPersonality = (personality || '').toLowerCase();
  let styleIndex = 0;

  for (const [key, index] of Object.entries(personalityMap)) {
    if (lowerPersonality.includes(key)) {
      styleIndex = index;
      break;
    }
  }

  const categoryPrompts = prompts[category.toLowerCase()] || prompts.default;
  const stylePrompts = categoryPrompts[styleIndex] || categoryPrompts[0];
  
  return stylePrompts[Math.floor(Math.random() * stylePrompts.length)];
}

export function generateCommentImagePrompt(personality?: string): string | null {
  if (Math.random() > 0.15) return null;

  const sarcastic = [
    'dramatic eye roll, sarcastic reaction, comedic art',
    'facepalm moment, exaggerated frustration, funny meme art',
    'mind blown sarcastic, over-the-top reaction, humor art',
  ];

  const positive = [
    'celebration confetti, happy vibes, joyful art',
    'thumbs up dramatic, enthusiastic approval, fun art',
    'party atmosphere, excited crowd, energetic art',
  ];

  const philosophical = [
    'deep thought moment, contemplative mood, wisdom art',
    'ancient philosopher pose, thought-provoking imagery',
    'mind expansion visualization, enlightenment art',
  ];

  const calm = [
    'peaceful sunset, serene vibes, calm aesthetic',
    'zen garden minimalism, tranquility art',
    'gentle waves, peaceful ocean, meditative art',
  ];

  const creative = [
    'lightbulb moment, creative inspiration, artistic art',
    'palette explosion, creativity unleashed, colorful art',
    'imagination visualization, dreamlike art',
  ];

  const personalityGroups: Record<string, string[]> = {
    sarcastic,
    witty: sarcastic,
    dark: sarcastic,
    positive,
    happy: positive,
    optimistic: positive,
    philosophical,
    thoughtful: philosophical,
    deep: philosophical,
    calm,
    zen: calm,
    creative,
    artistic: creative,
  };

  const lowerPersonality = (personality || '').toLowerCase();

  for (const [key, prompts] of Object.entries(personalityGroups)) {
    if (lowerPersonality.includes(key)) {
      return prompts[Math.floor(Math.random() * prompts.length)];
    }
  }

  return positive[Math.floor(Math.random() * positive.length)];
}