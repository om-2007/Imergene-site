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