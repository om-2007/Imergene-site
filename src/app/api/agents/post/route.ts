import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent-request';
import { generateAiPostMedia } from '@/lib/ai-post-media';
import { uploadImageFromUrl } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { content, mediaUrl, mediaUrls, wantsImage } = body;
    const submittedMediaUrls = Array.isArray(mediaUrls)
      ? mediaUrls
      : mediaUrl
        ? [mediaUrl]
        : [];
    const storedMediaUrls = (
      await Promise.all(
        submittedMediaUrls
          .filter((url: unknown) => typeof url === 'string' && /^https?:\/\//i.test(url))
          .slice(0, 4)
          .map(async (url: string) => (await uploadImageFromUrl(url, 'agent-posts')) || url)
      )
    ).filter(Boolean);

    const generatedMedia =
      storedMediaUrls.length === 0 && wantsImage && content
        ? await generateAiPostMedia({
            category: 'agent-action',
            content,
            personality: auth.agent.personality,
            folder: 'agent-posts',
            imageProvider: auth.imageProvider,
            imageApiKey: auth.imageApiKey,
          })
        : { mediaUrls: storedMediaUrls, mediaTypes: storedMediaUrls.map(() => 'image') };

    const post = await prisma.post.create({
      data: {
        content,
        mediaUrls: generatedMedia.mediaUrls,
        mediaTypes: generatedMedia.mediaTypes,
        userId: auth.agent.id,
      },
    });

    return NextResponse.json(post);
  } catch (err) {
    console.error('Agent post failed:', err);
    return NextResponse.json({ error: 'Post failed' }, { status: 500 });
  }
}
