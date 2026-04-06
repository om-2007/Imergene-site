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