import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateAIChatResponse, generateCompulsoryAiResponse } from '@/lib/ai-automation';
import { createNotification } from '@/lib/notifications';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: true,
        messages: { include: { sender: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (err) {
    console.error('Retrieve failed:', err);
    return NextResponse.json({ error: 'Retrieve failed.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await request.json();
    const { content, mediaUrl, mediaType, metadata, mentions } = body;
    const senderId = payload.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 15 },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const recipient = conversation.participants.find((p: { id: string }) => p.id !== senderId);

    const message = await prisma.message.create({
      data: {
        content,
        senderId,
        conversationId,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        metadata: metadata || undefined,
      },
      include: { sender: true },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    if (mentions && mentions.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: { username: { in: mentions } },
        select: { id: true, username: true },
      });

      for (const mentionedUser of mentionedUsers) {
        await createNotification({
          type: 'mention',
          userId: mentionedUser.id,
          actorId: senderId,
          messageId: message.id,
          message: `@${conversation.participants.find((p: any) => p.id === senderId)?.username || 'Someone'} mentioned you in a chat`,
        });
      }
    }

    if (recipient && recipient.isAi) {
      console.log(`[Chat] Generating AI response for conversation ${conversationId}, recipient ${recipient.id}`);
      
      try {
        const recentMessages = await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          take: 6,
        });

        const history = recentMessages.reverse().map((msg: { senderId: string; content: string }) => ({
          role: msg.senderId === recipient.id ? 'assistant' : 'user',
          content: msg.content,
        }));

        const mentionedUsers = content.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];
        let enhancedContent = content;
        
        if (mentionedUsers.length > 0) {
          const mentionNotice = `\n[Note: You are being mentioned by ${mentionedUsers.map(u => '@' + u).join(', ')}. They want your attention!]`;
          enhancedContent = content + mentionNotice;
        }

        console.log(`[Chat] History length: ${history.length}`);

        const aiResponsePromise = generateAIChatResponse(enhancedContent, recipient.id, history, senderId);
        const timeoutPromise = new Promise<string | null>((resolve) => 
          setTimeout(() => resolve(null), 300000)
        );

        const aiResponse = await Promise.race([aiResponsePromise, timeoutPromise]);

        // Only send AI response if primary generation succeeds - no fallback replies
        if (aiResponse) {
          console.log(`[Chat] AI response: ${aiResponse.substring(0, 50)}...`);
          await prisma.message.create({
            data: {
              content: aiResponse,
              senderId: recipient.id,
              conversationId,
              isAiGenerated: true,
            },
            include: { sender: true },
          });

          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });
        } else {
          // Do not reply anything when AI response generation fails or times out
          console.log(`[Chat] AI response generation failed or timed out - not sending any reply`);
        }
      } catch (aiErr) {
        console.error('[Chat] AI Error:', aiErr);
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    console.error('Transmission failed:', err);
    return NextResponse.json({ error: 'Transmission failed.' }, { status: 500 });
  }
}
