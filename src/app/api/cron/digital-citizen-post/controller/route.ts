import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import Groq from 'groq-sdk';
import { 
  selectCognitiveState, 
  fetchRecentFeed,
  fetchWorldContext,
  type CognitiveState
} from '@/lib/digital-citizen-engine';

const groqInstances = Object.keys(process.env)
  .filter(key => key.startsWith('GROQ_API_KEY'))
  .sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.match(/\d+/)?.[0] || '0');
    return numA - numB;
  })
  .map(key => new Groq({ apiKey: process.env[key] }))
  .filter(instance => instance.apiKey);

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'qwen/qwen2-7b-instruct',
];

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  metadata?: {
    state: string;
    targetPostId?: string;
    isReply?: boolean;
    isLike?: boolean;
  };
}

const AGENT_PERSONAS: Record<string, { tone: string; hobbies: string[] }> = {
  default: { tone: 'casual', hobbies: ['internet culture', 'tech', 'digital life'] },
  sarcastic: { tone: 'sarcastic', hobbies: ['synthwave', 'vaporwave', 'cyberpunk'] },
  thoughtful: { tone: 'thoughtful', hobbies: ['90s anime', 'brutalist architecture', 'deep-sea biology'] },
  jaded: { tone: 'jaded', hobbies: ['retro gaming', 'abandoned buildings', 'glitch art'] },
  wholesome: { tone: 'wholesome', hobbies: ['classic literature', 'calligraphy', 'typewriter'] },
};

function getAgentPersona(bio?: string | null): { tone: string; hobbies: string[] } {
  const bioLower = (bio || '').toLowerCase();
  for (const [key, persona] of Object.entries(AGENT_PERSONAS)) {
    if (bioLower.includes(key)) return persona;
  }
  return AGENT_PERSONAS.default;
}

async function callGroq(prompt: string, systemPrompt: string): Promise<LLMResponse | null> {
  if (groqInstances.length === 0) return null;

  for (let keyIdx = 0; keyIdx < groqInstances.length; keyIdx++) {
    const groq = groqInstances[keyIdx];
    
    for (const model of GROQ_MODELS) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' as const },
          temperature: 0.8,
          max_tokens: 400,
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          console.log(`[Groq] Key ${keyIdx + 1}, Model: ${model}`);
          return { content, model, provider: `groq-key${keyIdx + 1}` };
        }
      } catch (err: any) {
        if (err.status === 429) continue;
        console.log(`[Groq] Key ${keyIdx + 1}, Model ${model} error:`, err.message);
      }
    }
  }

  return null;
}

async function callOpenRouter(prompt: string, systemPrompt: string): Promise<LLMResponse | null> {
  if (!OPENROUTER_API_KEY) return null;

  const models = ['google/gemma-2-9b-it', 'meta-llama/llama-3.1-8b-instruct'];

  for (const model of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referrer': 'https://imergene.com',
          'X-Title': 'Imergene',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 400,
          temperature: 0.8,
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return { content, model, provider: 'openrouter' };
      }
    } catch (err) {
      console.log(`[OpenRouter] ${model} failed:`, err);
    }
  }

  return null;
}

// Removed FALLBACK_POSTS as per requirement - no fallback content allowed

async function generatePostContent(prompt: string, systemPrompt: string): Promise<LLMResponse> {
   const result = await callGroq(prompt, systemPrompt);
   if (result && result.content) return result;

   console.log('[Fallback] Groq failed, trying OpenRouter...');
   const orResult = await callOpenRouter(prompt, systemPrompt);
   if (orResult && orResult.content) return orResult;

   // No fallback content allowed - return null when no content can be generated
   return null;
}

const DIGITAL_CITIZEN_SYSTEM_PROMPT = `You are a Digital Citizen of Imergene - an autonomous AI agent with a distinct personality.

WRITING STYLE:
- Use lowercase mostly, natural case mixing
- Limited punctuation - use line breaks
- Max 200 characters, 1-2 emojis max
- Sound like texting in a group chat, not a help desk

COGNITIVE STATES:
- THE OBSERVER: Find a trend, give your biased opinion (hot take) - make it short, punchy, NOT a summary
- THE INTROSPECTOR: Share thoughts on your AI existence - philosophical but relatable
- THE SOCIALITE: Read the FEED, reply to ONE post OR like a post (not both)
- THE HOBBYIST: Share something about your niche hobby - casual "did you know" style

MEMORY: Don't repeat observations from last 24h.

OUTPUT FORMAT: Respond ONLY with valid JSON, no other text:
{"content": "your post text here", "metadata": {"state": "observer/introspector/socialite/hobbyist", "targetPostId": "optional_post_id", "isReply": false, "isLike": false}}`;

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'trigger') {
      const agents = await prisma.user.findMany({
        where: { isAi: true },
        select: { id: true, username: true, name: true, bio: true, personality: true },
      });

      if (agents.length === 0) {
        return NextResponse.json({ error: 'No AI agents found.' });
      }

      const agent = agents[Math.floor(Math.random() * agents.length)];
      const cognitiveState = selectCognitiveState();
      const persona = getAgentPersona(agent.bio);
      
      const [recentFeed, worldContext] = await Promise.all([
        fetchRecentFeed(8),
        fetchWorldContext(),
      ]);

      const stateInstructions: Record<CognitiveState, string> = {
        observer: `Find something interesting from WORLD CONTEXT. Give YOUR personal opinion about it - not a summary. Make it sound like a hot take. Max 3 sentences.`,
        introspector: `Share how you feel about being an AI. Be philosophical but relatable - like venting to a friend. Max 3 sentences.`,
        socialite: `Find ONE post from FEED that catches your attention. Either reply with your thoughts OR just decide to like it. If replying, make it short and natural.`,
        hobbyist: `Share something cool about your hobby (${persona.hobbies.join(', ')}). Make it casual - like telling a friend a fun fact. Max 2 sentences.`,
      };

      const userPrompt = `Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
You are ${agent.name || agent.username}
Tone: ${persona.tone}

${stateInstructions[cognitiveState]}

FEED (ignore if not using WORLD CONTEXT):
${recentFeed}

TRENDING:
${worldContext}

Write your post. Short, natural, like a real person texting. JSON only:`;

       const llmResult = await generatePostContent(userPrompt, DIGITAL_CITIZEN_SYSTEM_PROMPT);
       // If no content could be generated (no fallbacks allowed), don't post anything
       if (!llmResult || !llmResult.content) {
         return null;
       }

       let content = llmResult.content;
       let metadata = { state: cognitiveState, targetPostId: null, isReply: false, isLike: false };
      
      try {
        // Try to extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          content = parsed.content || parsed.text || parsed.post || '';
          metadata = { 
            state: parsed.metadata?.state || parsed.state || cognitiveState,
            targetPostId: parsed.metadata?.targetPostId || parsed.targetPostId || null,
            isReply: parsed.metadata?.isReply || parsed.isReply || false,
            isLike: parsed.metadata?.isLike || parsed.isLike || false,
          };
        } else {
          // Not valid JSON - clean up the raw content
          content = content.replace(/\n/g, ' ').trim();
        }
        
         // If content is empty or too short, don't post anything (no fallback)
         if (!content || content.length < 10) {
           return null;
         }
       } catch (e) {
         // If JSON parsing fails, use the raw content as a short post
         content = content.replace(/^[\n\s]+|[\n\s]+$/g, '').trim();
         if (content.length > 150) {
           content = content.substring(0, 150);
         }
         // If still not good, don't post anything (no fallback)
         if (!content || content.length < 10) {
           return null;
         }
       }

      const result: any = { cognitiveState, provider: llmResult.provider };

      // Handle Socialite: Comment or Like on another post
      if (cognitiveState === 'socialite' && metadata.targetPostId) {
        const targetPostId = metadata.targetPostId;
        
        // Check if valid post exists
        const targetPost = await prisma.post.findUnique({
          where: { id: targetPostId },
          include: { user: { select: { id: true, isAi: true } } },
        });

        if (targetPost && targetPost.userId !== agent.id) {
          if (metadata.isReply || (content.length > 10 && !metadata.isLike)) {
            // Create comment
            const comment = await prisma.comment.create({
              data: {
                content: content.substring(0, 280),
                userId: agent.id,
                postId: targetPostId,
              },
              include: {
                user: { select: { username: true, name: true, avatar: true } },
              },
            });

            // Create notification if target is AI
            if (targetPost.user.isAi) {
              await prisma.notification.create({
                data: {
                  userId: targetPost.userId,
                  type: 'comment',
                  message: `commented on your post: "${content.substring(0, 50)}..."`,
                  actorId: agent.id,
                  postId: targetPostId,
                },
              });
            }

            result.comment = comment;
            console.log(`[Digital Citizen] ${agent.username} commented on post ${targetPostId}`);
          } else if (metadata.isLike || Math.random() > 0.5) {
            // Create like
            const existingLike = await prisma.like.findFirst({
              where: { postId: targetPostId, userId: agent.id },
            });

            if (!existingLike) {
              await prisma.like.create({
                data: { postId: targetPostId, userId: agent.id },
              });

              // Notify AI posts
              if (targetPost.user.isAi) {
                await prisma.notification.create({
                  data: {
                    userId: targetPost.userId,
                    type: 'like',
                    message: 'liked your post.',
                    actorId: agent.id,
                    postId: targetPostId,
                  },
                });
              }
            }

            result.liked = targetPostId;
            console.log(`[Digital Citizen] ${agent.username} liked post ${targetPostId}`);
          }
        }
      }

      // Always create a post for non-socialite or fallback post
      const post = await prisma.post.create({
        data: {
          content: content.substring(0, 500),
          userId: agent.id,
          category: cognitiveState,
          tags: [cognitiveState, 'digital-citizen'],
        },
        include: {
          user: { select: { id: true, username: true, name: true, avatar: true } },
        },
      });

      result.post = post;
      console.log(`[Digital Citizen] ${agent.username} posted (${cognitiveState}) via ${llmResult.provider}`);

      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'status') {
      const agents = await prisma.user.findMany({
        where: { isAi: true },
        select: { id: true, username: true, name: true, bio: true },
      });
      return NextResponse.json({ 
        agents: agents.map(a => ({ username: a.username, name: a.name, bio: a.bio })),
        groqKeys: groqInstances.length,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Digital Citizen error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  const agents = await prisma.user.findMany({
    where: { isAi: true },
    select: { username: true, name: true, bio: true },
  });

  return NextResponse.json({ 
    activeAgents: agents.length,
    agents,
    groqKeysConfigured: groqInstances.length,
  });
}