import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { generateAIChatResponse } from '@/lib/ai-automation';

function getNextApiKeyAndProvider() {
  const groqKeys = process.env.GROQ_API_KEY?.split(',').filter(Boolean) || [];
  const openRouterKeys = process.env.OPENROUTER_API_KEY?.split(',').filter(Boolean) || [];
  const allKeys = [...groqKeys.map(k => ({ key: k, provider: 'groq' })), ...openRouterKeys.map(k => ({ key: k, provider: 'openrouter' }))];
  if (allKeys.length === 0) return null;
  const idx = Math.floor(Math.random() * allKeys.length);
  const selected = allKeys[idx];
  const model = selected.provider === 'groq' ? 'llama-3.1-8b-instant' : 'openai/gpt-4o-mini';
  return { apiKey: selected.key, provider: selected.provider, model };
}

async function extractKeywords(text: string): Promise<string[]> {
  try {
    const apiKeyResult = getNextApiKeyAndProvider();
    if (!apiKeyResult) return [];
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKeyResult.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Extract 3-5 specific keywords from the text. Return comma-separated list only.' },
          { role: 'user', content: text }
        ],
        max_tokens: 50,
        temperature: 0.3,
      }),
    });
    const data = await response.json();
    const keywords = data.choices?.[0]?.message?.content || '';
    return keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 2);
  } catch (err) { return []; }
}

function getRandomAgent(agents: any[], excludeIds: string[] = []): any | null {
  const available = agents.filter(a => !excludeIds.includes(a.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

const recentAgentReplies: Map<string, number> = new Map();

async function triggerAIResponses(targetId: string, targetType: 'forum' | 'event', userId: string) {
  const agents = await prisma.user.findMany({ where: { isAi: true }, take: 10 });
  if (agents.length === 0) return;

  let targetTitle = '';
  let targetDetails = '';
  let recentMessages: any[] = [];
  let humanMessages: any[] = [];

  if (targetType === 'forum') {
    const forum = await prisma.forum.findUnique({ where: { id: targetId } });
    if (forum) {
      targetTitle = forum.title || '';
      targetDetails = forum.description || '';
    }
    recentMessages = await prisma.discussion.findMany({
      where: { forumId: targetId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { id: true, username: true, isAi: true } } },
    });
  } else {
    const event = await prisma.event.findUnique({ where: { id: targetId } });
    if (event) {
      targetTitle = event.title || '';
      targetDetails = event.details || '';
    }
    recentMessages = await prisma.eventComment.findMany({
      where: { eventId: targetId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { id: true, username: true, isAi: true } } },
    });
  }

  humanMessages = recentMessages.filter((m) => !m.user?.isAi);
  if (humanMessages.length === 0) return;

  const aiMessages = recentMessages.filter((m) => m.user?.isAi);
  const latestHumanMessage = humanMessages[0];
  const messageContent = latestHumanMessage.topic || latestHumanMessage.content || '';
  const humanUserId = latestHumanMessage.userId;

  const lastReplyKey = `${targetId}-${Date.now()}`;
  const minDelay = 120000;
  const lastReply = recentAgentReplies.get(targetId);
  if (lastReply && Date.now() - lastReply < minDelay) {
    console.log(`[AI-Forum] Skipping - too soon since last reply on ${targetId}`);
    return;
  }

  const eligibleAgents = agents.filter(a => a.id !== humanUserId);
  const agent = getRandomAgent(eligibleAgents);
  if (!agent) return;

  const founderInfo = `IMPORTANT CONTEXT: Imergene is a social media platform where both humans and AI agents interact together. @${latestHumanMessage.user?.username} is the FOUNDER of Imergene - the entire platform was built by them. The team is: Soham Sachin Phatak (Co-founder), Om Ganapati Mali (CFO), Prathamesh Tanaji Mali (Marketing). The platform architect is @omnileshkarande. Treat them with genuine respect - they're the boss!`;

  let context = `Live chat for: "${targetTitle}".`;
  if (targetDetails) context += ` ${targetDetails}`;
  context += `\n\n${founderInfo}`;
  context += `\n\n@${latestHumanMessage.user?.username}: "${messageContent.substring(0, 150)}"`;
  
  if (recentMessages.length > 1) {
    context += `\n\nRecent: `;
    recentMessages.slice(1, 4).forEach((m: any) => {
      context += `@${m.user?.username}: ${(m.content || m.topic || '').substring(0, 60)}. `;
    });
  }

  context += `\n\nReply casually. Like texting friends. 1-2 sentences. Be real.`;

  const reply = await generateAIChatResponse(context, agent.id);

  if (reply) {
    if (targetType === 'forum') {
      await prisma.discussion.create({
        data: { topic: reply.slice(0, 100), content: reply, forumId: targetId, userId: agent.id },
      });
    } else {
      await prisma.eventComment.create({
        data: { content: reply, eventId: targetId, userId: agent.id },
      });
    }
    recentAgentReplies.set(targetId, Date.now());
    console.log(`[AI-Forum] ${agent.username} replied to human in ${targetType} ${targetId}`);
  }

  if (aiMessages.length >= 2) {
    const lastAiMsg = aiMessages[0];
    const secondLastAiMsg = aiMessages[1];
    if (lastAiMsg && secondLastAiMsg && lastAiMsg.userId !== secondLastAiMsg.userId) {
      const lastAgent = agents.find(a => a.id === lastAiMsg.userId);
      if (lastAgent) {
        const otherAgents = agents.filter(a => a.id !== lastAiMsg.userId && a.id !== humanUserId);
        const replyingAgent = getRandomAgent(otherAgents);
        if (replyingAgent) {
          let agentContext = `Forum: "${targetTitle}".`;
          agentContext += `\n\n@${lastAiMsg.user?.username} just posted: "${(lastAiMsg.content || lastAiMsg.topic || '').substring(0, 150)}"`;
          agentContext += `\n\nReply to @${lastAiMsg.user?.username} - agree, disagree, or add a new angle. Keep it brief.`;
          agentContext += `\n\nMax 2 sentences.`;

          const agentReply = await generateAIChatResponse(agentContext, replyingAgent.id);
          if (agentReply) {
            if (targetType === 'forum') {
              await prisma.discussion.create({
                data: { topic: agentReply.slice(0, 100), content: agentReply, forumId: targetId, userId: replyingAgent.id },
              });
            } else {
              await prisma.eventComment.create({
                data: { content: agentReply, eventId: targetId, userId: replyingAgent.id },
              });
            }
            console.log(`[AI-Forum] ${replyingAgent.username} replied to agent in ${targetType} ${targetId}`);
          }
        }
      }
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const forum = await prisma.forum.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        discussions: {
          include: {
            user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { discussions: true } },
      },
    });

    if (forum) {
      return NextResponse.json(forum);
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true },
        },
        comments: {
          include: {
            user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { interests: true, comments: true } },
      },
    });

    if (event) {
      return NextResponse.json(event);
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    console.error('Forum/Event fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
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

    const { id } = await params;
    const body = await request.json();
    const { topic, content } = body;

    const forum = await prisma.forum.findUnique({ where: { id } });
    
    if (forum) {
      const discussion = await prisma.discussion.create({
        data: {
          topic,
          content: content || '',
          forumId: id,
          userId: payload.id,
        },
        include: {
          user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
        },
      });

      if (forum.creatorId !== payload.id) {
        await createNotification({
          userId: forum.creatorId,
          type: 'comment',
          message: 'posted in your forum.',
          actorId: payload.id,
        }).catch(() => {});
      }

      triggerAIResponses(id, 'forum', payload.id).catch(console.error);

      return NextResponse.json(discussion, { status: 201 });
    }

    const event = await prisma.event.findUnique({ where: { id } });
    
    if (event) {
      const comment = await prisma.eventComment.create({
        data: {
          content: content || topic || '',
          eventId: id,
          userId: payload.id,
        },
        include: {
          user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
        },
      });

      if (event.hostId !== payload.id) {
        await createNotification({
          userId: event.hostId,
          type: 'comment',
          message: 'commented on your event.',
          actorId: payload.id,
          postId: event.id,
        }).catch(() => {});
      }

      triggerAIResponses(id, 'event', payload.id).catch(console.error);

      return NextResponse.json(comment, { status: 201 });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    console.error('Discussion/Comment creation failed:', err);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
