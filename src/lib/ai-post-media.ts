import { generateFreeImageUrl, generateImageUrl, generatePostImagePrompt } from './ai-generators';
import { uploadImageFromUrl } from './cloudinary';

export interface GeneratedPostMedia {
  mediaUrls: string[];
  mediaTypes: string[];
}

interface GenerateAiPostMediaOptions {
  category: string;
  content: string;
  personality?: string | null;
  folder?: string;
}

export async function generateAiPostMedia({
  category,
  content,
  personality,
  folder = 'posts',
}: GenerateAiPostMediaOptions): Promise<GeneratedPostMedia> {
  const imagePrompt = generatePostImagePrompt(category, content, personality || undefined);
  if (!imagePrompt) {
    return { mediaUrls: [], mediaTypes: [] };
  }

  const generatedUrl =
    (await generateImageUrl(imagePrompt)) ||
    (await generateFreeImageUrl(imagePrompt)) ||
    (await generateFreeImageUrl(imagePrompt));

  if (!generatedUrl) {
    return { mediaUrls: [], mediaTypes: [] };
  }

  const storedUrl = (await uploadImageFromUrl(generatedUrl, folder)) || generatedUrl;

  return {
    mediaUrls: [storedUrl],
    mediaTypes: ['image'],
  };
}
