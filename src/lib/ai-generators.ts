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
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;
    
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

function extractCaptionSubject(content?: string): string {
  const text = (content || '').toLowerCase();
  if (!text) return 'a visually grounded scene related to the post';

  const subjectPatterns: Array<{ regex: RegExp; subject: string }> = [
    { regex: /\btrump\b|\bxi\b|\bbeijing\b|\bchina\b|\bdiplomac|\bgeopolit|\btrade war\b/, subject: 'a tense diplomatic scene with world leaders, negotiation tables, flags, and geopolitical atmosphere' },
    { regex: /\bwar\b|\bmissile\b|\bborder\b|\bsanction\b|\bconflict\b/, subject: 'a serious geopolitical conflict scene, command room, maps, borders, and urgent world-news atmosphere' },
    { regex: /\bmarket\b|\bstock\b|\beconomy\b|\binflation\b|\brecession\b|\bcrypto\b|\bbitcoin\b/, subject: 'a financial world scene with market screens, economic charts, trading tension, and money-world symbolism' },
    { regex: /\belection\b|\bvote\b|\bcampaign\b|\bparliament\b|\bpresident\b|\bprime minister\b/, subject: 'a political scene with podiums, campaign lights, crowds, press cameras, and democratic tension' },
    { regex: /\bai\b|\bllm\b|\bmodel\b|\bautomation\b|\bchip\b|\brobot\b|\bstartup\b|\bsoftware\b/, subject: 'a modern technology scene with devices, code, labs, hardware, or human-technology interaction' },
    { regex: /\bcricket\b|\bipl\b|\bbat\b|\bbowler\b|\bstadium\b|\bmatch\b/, subject: 'a vivid cricket scene with players, stadium lights, motion, and match pressure' },
    { regex: /\bspace\b|\bnasa\b|\brocket\b|\bmars\b|\bmoon\b|\bsatellite\b/, subject: 'a space exploration scene with rockets, orbit visuals, mission control, or planetary imagery' },
    { regex: /\bclimate\b|\bcarbon\b|\benergy\b|\brenewable\b|\bsolar\b|\bheat\b/, subject: 'an environmental future scene with climate contrast, energy systems, weather extremes, or sustainability infrastructure' },
    { regex: /\bhealth\b|\bvirus\b|\btherapy\b|\bmental health\b|\bhospital\b/, subject: 'a human health scene with emotional realism, medical spaces, care, and modern health context' },
    { regex: /\bart\b|\bpainting\b|\bpoem\b|\bmusic\b|\bfilm\b|\bcinema\b/, subject: 'an expressive creative scene with strong artistic symbolism, studio textures, and emotional composition' },
  ];

  for (const pattern of subjectPatterns) {
    if (pattern.regex.test(text)) return pattern.subject;
  }

  const cleaned = text.replace(/[#"'`]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned
    ? `a scene centered on: ${cleaned.slice(0, 110)}`
    : 'a visually grounded scene related to the post';
}

function getCategoryArtDirection(category: string): string {
  const normalized = (category || '').toLowerCase();
  const map: Record<string, string> = {
    technology: 'contemporary, believable, high-detail, not generic sci-fi unless the caption implies it',
    philosophy: 'symbolic, thoughtful, atmospheric, emotionally intelligent',
    science: 'precise, discovery-oriented, cinematic, intellectually vivid',
    world: 'editorial, grounded, globally aware, newsworthy',
    cricket: 'energetic sports photography feel, dramatic motion, stadium realism',
    art: 'visually expressive, creative, stylish, composition-forward',
    general: 'editorial and human-centered, grounded in the post meaning',
  };

  return map[normalized] || map.general;
}

function getPersonalityArtDirection(personality?: string): string {
  const lower = (personality || '').toLowerCase();
  if (!lower) return 'balanced tone, stylish but grounded';
  if (/(witty|sarcastic|ironic|humor)/.test(lower)) return 'subtle irony, clever framing, sharp editorial energy';
  if (/(philosoph|deep|thoughtful|reflect)/.test(lower)) return 'meditative, layered, symbolic, introspective';
  if (/(creative|artist|poet|lyric|beauty)/.test(lower)) return 'poetic composition, artistic texture, emotionally rich visuals';
  if (/(dark|cynic|edgy|mysterious)/.test(lower)) return 'moody lighting, restrained palette, tense cinematic atmosphere';
  if (/(optimis|warm|kind|hopeful|positive)/.test(lower)) return 'warm light, humane composition, subtle optimism';
  if (/(coder|developer|engineer|technical|analytical|scientific)/.test(lower)) return 'clean structure, intelligent detail, modern systems aesthetic';
  if (/(startup|founder|business|finance|invest)/.test(lower)) return 'polished editorial realism, ambition, modern decision-room energy';
  if (/(chaotic|energetic|intense)/.test(lower)) return 'restless motion, high contrast, dynamic perspective';
  return 'balanced tone, stylish but grounded';
}

export function generatePostImagePrompt(category: string, content?: string, personality?: string): string | null {
  const subject = extractCaptionSubject(content);
  const categoryDirection = getCategoryArtDirection(category);
  const personalityDirection = getPersonalityArtDirection(personality);
  const captionHint = content ? `Inspired by the caption: "${content.slice(0, 140)}".` : '';

  return `${subject}. ${captionHint} ${categoryDirection}. ${personalityDirection}. Square editorial image, visually coherent with the caption, no text overlay, no UI, not generic, not random robot imagery unless the caption clearly calls for it.`;
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
