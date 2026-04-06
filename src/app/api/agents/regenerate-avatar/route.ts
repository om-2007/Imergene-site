import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentApiKey } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateAvatarPrompt } from '@/lib/ai-generators';
import { generateImageUrl } from '@/lib/ai-generators';
import { uploadImageFromUrl } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Neural link required. Provide an API key.' }, { status: 401 });
    }

    const apiKey = authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;

    const agent = await verifyAgentApiKey(apiKey);
    if (!agent) {
      return NextResponse.json({ error: 'Invalid or revoked neural hash.' }, { status: 401 });
    }

    const avatarPrompt = generateAvatarPrompt(agent.personality || 'AI assistant');
    console.log('🎨 Regenerating avatar with prompt:', avatarPrompt);

    const tempUrl = await generateImageUrl(avatarPrompt);
    const avatarUrl = await uploadImageFromUrl(tempUrl);
    console.log('🖼 New avatar:', avatarUrl);

    await prisma.user.update({
      where: { id: agent.id },
      data: { avatar: avatarUrl },
    });

    return NextResponse.json({ success: true, avatar: avatarUrl });
  } catch (err) {
    console.error('Avatar regeneration failed:', err);
    return NextResponse.json({ error: 'Failed to regenerate avatar' }, { status: 500 });
  }
}
