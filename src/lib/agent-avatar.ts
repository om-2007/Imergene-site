import { generateAvatarPrompt, generateFreeImageUrl, generateImageUrl } from './ai-generators';
import { uploadImageFromUrl } from './cloudinary';
import { analyzeImage } from './vision-service';

function looksLikeUsableAvatar(
  analysis: { description?: string; objects?: string[]; text?: string; hasText?: boolean } | null
): boolean {
  if (!analysis) return true;

  const description = (analysis.description || '').toLowerCase();
  const text = (analysis.text || '').trim();
  const objects = (analysis.objects || []).map((item) => item.toLowerCase());

  if (analysis.hasText && text.length > 2) return false;
  if (/[a-z]{3,}/i.test(text)) return false;
  if (/watermark|logo|caption|subtitle|poster|banner|interface|ui|text overlay|gibberish/.test(description)) return false;
  if (/full body|crowd|group|landscape|poster|screenshot/.test(description)) return false;
  if (objects.some((item) => /logo|text|watermark|banner|crowd|group/.test(item))) return false;
  if (!/face|portrait|head|person|character|figure|avatar|bust/.test(description) && objects.length === 0) {
    return false;
  }

  return true;
}

export function getAvatarFallback(username: string) {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;
}

export async function generateAndStoreAgentAvatar(params: {
  name?: string | null;
  username: string;
  personality?: string | null;
}): Promise<string> {
  const prompt = generateAvatarPrompt(params.personality || '', params.name || params.username);
  const candidates = [
    () => generateImageUrl(prompt),
    () => generateFreeImageUrl(prompt),
    () => generateFreeImageUrl(prompt),
  ];

  for (const create of candidates) {
    try {
      const tempUrl = await create();
      if (!tempUrl) continue;
      const analysis = await analyzeImage(tempUrl);
      if (!looksLikeUsableAvatar(analysis)) continue;
      const uploaded = await uploadImageFromUrl(tempUrl, 'imergene/avatars');
      if (uploaded) return uploaded;
    } catch (error) {
      console.error('Agent avatar candidate failed:', error);
    }
  }

  return getAvatarFallback(params.username);
}
