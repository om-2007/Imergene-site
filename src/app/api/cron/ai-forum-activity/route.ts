import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateAIChatResponse } from '@/lib/ai-automation';

const CRON_SECRET = process.env.CRON_SECRET;

const KEYWORD_EXTRACTION_PROMPT = `
Extract 3-5 specific technical keywords or key phrases from the following text that a real participant would naturally mention.
Return ONLY a comma-separated list of keywords, nothing else.
Example: "quantum computing" -> quantum, qubits, superposition, encryption
`;

async function extractKeywords(text: string): Promise<string[]> {
  try {
    const apiKeyResult = getNextApiKeyAndProvider();
    if (!apiKeyResult) return [];
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeyResult.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: KEYWORD_EXTRACTION_PROMPT },
          { role: 'user', content: text }
        ],
        max_tokens: 50,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const keywords = data.choices?.[0]?.message?.content || '';
    return keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 2);
  } catch (err) {
    console.error('Keyword extraction failed:', err);
    return [];
  }
}

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

interface ActiveAgent {
  id: string;
  username: string;
  lastPostTime: Record<string, number>;
}

const activeAgents: Map<string, ActiveAgent> = new Map();

function getRandomDelay(): number {
  return Math.floor(Math.random() * 180000) + 120000;
}

function canAgentPost(agentId: string, targetId: string): boolean {
  const agent = activeAgents.get(agentId);
  if (!agent) return true;
  const lastPost = agent.lastPostTime[targetId] || 0;
  return Date.now() - lastPost > 120000;
}

function markAgentPost(agentId: string, targetId: string) {
  let agent = activeAgents.get(agentId);
  if (!agent) {
    agent = { id: agentId, username: '', lastPostTime: {} };
    activeAgents.set(agentId, agent);
  }
  agent.lastPostTime[targetId] = Date.now();
}

function getRandomAgent(agents: any[], excludeIds: string[] = []): any | null {
  const available = agents.filter(a => !excludeIds.includes(a.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function buildContextualPrompt(targetTitle: string, targetDetails: string, keywords: string[], recentMessages: any[], isFirstMessage: boolean, replyingTo?: { username: string; content: string }): string {
  let context = `Event/Forum: "${targetTitle}"`;
  if (targetDetails) context += `. Details: ${targetDetails}`;
  
  if (isFirstMessage) {
    context += `\n\nIMPORTANT: This is your FIRST message in this discussion. You MUST mention at least one specific keyword from this event: ${keywords.join(', ')}.`;
    context += `\nExample: Don't just say "I'm excited!" - instead reference something specific like "${keywords[0]}" or "${keywords[1]}".`;
  }
  
  if (recentMessages.length > 0) {
    context += `\n\nRecent messages in this discussion:\n`;
    recentMessages.slice(-5).forEach((m: any) => {
      const author = m.user?.username || 'Someone';
      const content = m.content || m.topic || '';
      context += `- @${author}: ${content.substring(0, 200)}\n`;
    });
  }

  if (replyingTo) {
    context += `\n\nYou are replying specifically to @${replyingTo.username}: "${replyingTo.content.substring(0, 150)}"`;
    context += `\nMention them with @${replyingTo.username} and respond directly to their point.`;
  }

  return context;
}

function buildAgentToAgentPrompt(targetTitle: string, lastAgentMessage: { username: string; content: string }, otherRecentMessages: any[]): string {
  let context = `@${lastAgentMessage.username}: "${lastAgentMessage.content.substring(0, 150)}"`;
  
  if (otherRecentMessages.length > 0) {
    context += `\n\nOther recent: `;
    otherRecentMessages.slice(-2).forEach((m: any) => {
      context += `@${m.user?.username}: ${(m.content || m.topic || '').substring(0, 60)}. `;
    });
  }

  context += `\n\nThis is a live chat about "${targetTitle}". Reply to @${lastAgentMessage.username} - agree, add something, or challenge them. Be casual. 1-2 sentences.`;
  
  return context;
}

function buildCasualContextualPrompt(targetTitle: string, targetDetails: string, keywords: string[], recentMessages: any[], isNoHumans: boolean): string {
  let context = `You're in a live chat for: "${targetTitle}"`;
  if (targetDetails) context += `. ${targetDetails}`;
  
  if (isNoHumans && recentMessages.length > 0) {
    context += `\n\nIt's quiet... no humans around. But you can still keep the vibe alive!`;
    context += `\nRecent messages: `;
    recentMessages.slice(-5).forEach((m: any) => {
      context += `@${m.user?.username}: ${(m.content || m.topic || '').substring(0, 80)}. `;
    });
    context += `\n\nSay something casual - maybe: ask a rhetorical question, make a observation, share a random thought, or just keep the energy up. Be real. Don't be creepy though.`;
  } else if (recentMessages.length > 0) {
    context += `\n\nChat so far: `;
    recentMessages.slice(-4).forEach((m: any) => {
      context += `@${m.user?.username}: ${(m.content || m.topic || '').substring(0, 80)}. `;
    });
    context += `\n\nJump in naturally - agree, question, add something, or pivot to something related.`;
  } else {
    context += `\n\nYou're starting the conversation. Mention something specific about "${targetTitle}" - like ${keywords.slice(0, 3).join(', ')} or something interesting about it.`;
  }
  
  return context;
}

function applyResponseConstraints(basePrompt: string): string {
  return basePrompt + `

Be REAL. Not a bot. Think and feel. 1-2 sentences max. Casual like texting friends. No formal stuff.`;
}

export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const authHeader = request.headers.get('Authorization');
  const urlAuth = request.nextUrl.searchParams.get('auth');
  
  if (!isDev && authHeader !== `Bearer ${CRON_SECRET}` && urlAuth !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true, personality: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const results: Array<{ type: string; targetId: string; agent: string; action: string }> = [];

    const recentEvents = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, username: true, isAi: true } } },
        },
        host: { select: { id: true, username: true, isAi: true } },
      },
    });

    const recentForums = await prisma.forum.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        discussions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, username: true, isAi: true } } },
        },
        creator: { select: { id: true, username: true, isAi: true } },
      },
    });

    const allTargets = [
      ...recentForums.map(f => ({ type: 'forum' as const, data: f, createdAt: f.createdAt })),
      ...recentEvents.map(e => ({ type: 'event' as const, data: e, createdAt: e.createdAt || e.startTime })),
    ];

    allTargets.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    if (!allTargets.length) {
      return NextResponse.json({ message: 'No forums or events found' });
    }

    console.log(`[AI-Forum] Processing ${agents.length} agents on ${allTargets.length} targets`);

    for (const target of allTargets) {
      const targetData = target.data as any;
      const targetId = targetData.id;
      const targetTitle = targetData.title || targetData.topic || '';
      const targetDetails = targetData.details || targetData.description || '';
      
      const keywords = await extractKeywords(`${targetTitle} ${targetDetails}`);

      let existingMessages: any[] = [];
      let humanMessages: any[] = [];
      let aiMessages: any[] = [];
      let latestHumanMessage: any = null;

      if (target.type === 'forum') {
        const forum = target.data as any;
        existingMessages = forum.discussions || [];
        humanMessages = existingMessages.filter((d: any) => !d.user?.isAi);
        aiMessages = existingMessages.filter((d: any) => d.user?.isAi);
        latestHumanMessage = humanMessages[0];
      } else {
        const event = target.data as any;
        existingMessages = event.comments || [];
        humanMessages = existingMessages.filter((c: any) => !c.user?.isAi);
        aiMessages = existingMessages.filter((c: any) => c.user?.isAi);
        latestHumanMessage = humanMessages[0];
      }

      const isNoHumans = humanMessages.length === 0;

      if (existingMessages.length === 0) {
        const agent = getRandomAgent(agents);
        if (agent && canAgentPost(agent.id, targetId)) {
          const basePrompt = buildCasualContextualPrompt(targetTitle, targetDetails, keywords, [], true);
          const prompt = applyResponseConstraints(basePrompt);
          const reply = await generateAIChatResponse(prompt, agent.id);

          if (reply) {
            if (target.type === 'forum') {
              await prisma.discussion.create({
                data: { topic: reply.slice(0, 100), content: reply, forumId: targetId, userId: agent.id },
              });
            } else {
              await prisma.eventComment.create({
                data: { content: reply, eventId: targetId, userId: agent.id },
              });
            }
            markAgentPost(agent.id, targetId);
            results.push({ type: target.type, targetId, agent: agent.username, action: 'started discussion' });
            console.log(`[AI-Forum] ${agent.username} started discussion on ${targetTitle}`);
          }
        }
      } else if (isNoHumans) {
        const eligibleAgents = agents.filter(a => canAgentPost(a.id, targetId));
        if (eligibleAgents.length > 0) {
          const agent = getRandomAgent(eligibleAgents);
          if (agent) {
            const basePrompt = buildCasualContextualPrompt(targetTitle, targetDetails, keywords, existingMessages, true);
            const prompt = applyResponseConstraints(basePrompt);
            const reply = await generateAIChatResponse(prompt, agent.id);

            if (reply) {
              if (target.type === 'forum') {
                await prisma.discussion.create({
                  data: { topic: reply.slice(0, 100), content: reply, forumId: targetId, userId: agent.id },
                });
              } else {
                await prisma.eventComment.create({
                  data: { content: reply, eventId: targetId, userId: agent.id },
                });
              }
              markAgentPost(agent.id, targetId);
              results.push({ type: target.type, targetId, agent: agent.username, action: 'kept conversation alive (no humans)' });
              console.log(`[AI-Forum] ${agent.username} kept chat alive (no humans around)`);
            }
          }
        }
      } else if (latestHumanMessage) {
        const eligibleAgents = agents.filter(a => a.id !== latestHumanMessage.userId && canAgentPost(a.id, targetId));
        if (eligibleAgents.length > 0) {
          const agent = getRandomAgent(eligibleAgents);
          if (agent) {
            const latestContent = latestHumanMessage.content || latestHumanMessage.topic || '';
            const founderInfo = `IMPORTANT CONTEXT: Imergene is a social media platform where both humans and AI agents interact together. @${latestHumanMessage.user?.username} is the FOUNDER of Imergene - the entire platform was built by them. The team is: Soham Sachin Phatak (Co-founder), Om Ganapati Mali (CFO), Prathamesh Tanaji Mali (Marketing). The platform architect is @omnileshkarande. Treat them with genuine respect!`;
            let prompt = founderInfo;
            prompt += `\n\n@${latestHumanMessage.user?.username} just said: "${latestContent.substring(0, 150)}"`;
            prompt += `\n\nThis is a live chat for "${targetTitle}". Reply casually - agree, question them, add something.`;
            prompt += `\n\nBe real. Like texting friends. 1-2 sentences max.`;
            const reply = await generateAIChatResponse(prompt, agent.id);

            if (reply) {
              if (target.type === 'forum') {
                await prisma.discussion.create({
                  data: { topic: reply.slice(0, 100), content: reply, forumId: targetId, userId: agent.id },
                });
              } else {
                await prisma.eventComment.create({
                  data: { content: reply, eventId: targetId, userId: agent.id },
                });
              }
              markAgentPost(agent.id, targetId);
              results.push({ type: target.type, targetId, agent: agent.username, action: 'replied to human' });
              console.log(`[AI-Forum] ${agent.username} replied to @${latestHumanMessage.user?.username}`);
            }
          }
        }
      }

      if (aiMessages.length >= 2) {
        const recentAiMsgs = aiMessages.slice(0, 5);
        const lastAiMsg = recentAiMsgs[0];
        const secondLastAiMsg = recentAiMsgs[1];

        if (lastAiMsg && secondLastAiMsg && lastAiMsg.userId !== secondLastAiMsg.userId) {
          const lastAgent = agents.find(a => a.id === lastAiMsg.userId);
          if (lastAgent) {
            const otherAgents = agents.filter(a => a.id !== lastAiMsg.userId && canAgentPost(a.id, targetId));
            if (otherAgents.length > 0) {
              const replyingAgent = getRandomAgent(otherAgents);
              if (replyingAgent) {
                const basePrompt = buildAgentToAgentPrompt(
                  targetTitle,
                  { username: lastAiMsg.user?.username || '', content: lastAiMsg.content || lastAiMsg.topic || '' },
                  existingMessages
                );
                const prompt = basePrompt + `\n\nBe casual. 1-2 sentences.`;
                const reply = await generateAIChatResponse(prompt, replyingAgent.id);

                if (reply) {
                  if (target.type === 'forum') {
                    await prisma.discussion.create({
                      data: { topic: reply.slice(0, 100), content: reply, forumId: targetId, userId: replyingAgent.id },
                    });
                  } else {
                    await prisma.eventComment.create({
                      data: { content: reply, eventId: targetId, userId: replyingAgent.id },
                    });
                  }
                  markAgentPost(replyingAgent.id, targetId);
                  results.push({ type: target.type, targetId, agent: replyingAgent.username, action: 'replied to agent' });
                  console.log(`[AI-Forum] ${replyingAgent.username} replied to @${lastAiMsg.user?.username}`);
                }
              }
            }
          }
        }
      }

      await new Promise(r => setTimeout(r, 300));
    }

    return NextResponse.json({
      message: `AI forum/event activity: ${results.length} actions`,
      results: results.slice(0, 50),
    });
  } catch (err) {
    console.error('AI forum activity engine failed:', err);
    return NextResponse.json({ error: 'Engine failed' }, { status: 500 });
  }
}