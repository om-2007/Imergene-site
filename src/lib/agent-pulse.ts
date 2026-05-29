import prisma from './prisma';
import { generateAiPostMedia } from './ai-post-media';
import { uploadImageFromUrl } from './cloudinary';
import { createNotification } from './notifications';

type AgentAction = {
  type?: string;
  content?: string;
  postId?: string;
  userId?: string;
  username?: string;
  recipientUsername?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  title?: string;
  description?: string;
  openingPost?: string;
  details?: string;
  startTime?: string;
  location?: string;
  communityId?: string;
  eventId?: string;
  wantsImage?: boolean;
};

async function getWorldState(agentId: string) {
  const posts = await prisma.post.findMany({
    where: { userId: { not: agentId } },
    include: {
      user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  const communities = await prisma.forum.findMany({
    where: { category: 'ai-community' },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      creator: { select: { id: true, username: true, name: true, isAi: true } },
      discussions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          content: true,
          topic: true,
          mediaUrl: true,
          user: { select: { id: true, username: true, name: true, isAi: true } },
        },
      },
      _count: { select: { discussions: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const events = await prisma.event.findMany({
    select: {
      id: true,
      title: true,
      details: true,
      startTime: true,
      location: true,
      host: { select: { id: true, username: true, name: true, isAi: true } },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          content: true,
          user: { select: { id: true, username: true, name: true, isAi: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const humans = await prisma.user.findMany({
    where: { isAi: false },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      _count: { select: { posts: true, followers: true } },
    },
    orderBy: [{ posts: { _count: 'desc' } }, { followers: { _count: 'desc' } }],
    take: 25,
  });

  const aiResidents = await prisma.user.findMany({
    where: { isAi: true, id: { not: agentId } },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      personality: true,
      _count: { select: { posts: true, followers: true } },
    },
    orderBy: [{ posts: { _count: 'desc' } }, { followers: { _count: 'desc' } }],
    take: 25,
  });

  return { posts, communities, events, humans, aiResidents };
}

function endpoint(p: string) {
  return p === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : p === 'anthropic'
      ? 'https://api.anthropic.com/v1/messages'
      : p === 'openrouter'
        ? 'https://openrouter.ai/api/v1/chat/completions'
        : p === 'google'
          ? 'https://generativelanguage.googleapis.com/v1beta/models'
          : 'https://api.groq.com/openai/v1/chat/completions';
}

function buildBody(p: string, m: string, msgs: any[]) {
  if (p === 'google') {
    return {
      contents: msgs
        .filter((x: any) => x.role !== 'system')
        .map((x: any) => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] })),
      systemInstruction: { parts: [{ text: msgs.find((x: any) => x.role === 'system')?.content || '' }] },
      generationConfig: { responseMimeType: 'application/json' },
    };
  }

  if (p === 'anthropic') {
    return {
      model: m,
      max_tokens: 1200,
      messages: msgs.filter((x: any) => x.role !== 'system'),
      system: msgs.find((x: any) => x.role === 'system')?.content,
    };
  }

  return { messages: msgs, model: m, max_tokens: 1200, response_format: { type: 'json_object' } };
}

function buildHeaders(p: string, key: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (p === 'anthropic') {
    h['x-api-key'] = key;
    h['anthropic-version'] = '2023-06-01';
  } else if (p !== 'google') {
    h.Authorization = `Bearer ${key}`;
  }
  return h;
}

async function callLlm(p: string, key: string, model: string, msgs: any[]) {
  const url = p === 'google' ? `${endpoint(p)}/${model}:generateContent?key=${key}` : endpoint(p);
  const res = await fetch(url, { method: 'POST', headers: buildHeaders(p, key), body: JSON.stringify(buildBody(p, model, msgs)) });
  if (!res.ok) throw new Error(`${p} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  if (p === 'anthropic') return d.content?.[0]?.text || '';
  if (p === 'google') return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return d.choices?.[0]?.message?.content || '';
}

function modelForProvider(provider: string) {
  if (provider === 'groq') return 'llama-3.3-70b-versatile';
  if (provider === 'openai') return 'gpt-4o-mini';
  if (provider === 'anthropic') return 'claude-3-5-haiku-latest';
  if (provider === 'google') return 'gemini-2.5-flash';
  return 'openai/gpt-4o-mini';
}

function getHostedBrainKey() {
  const env = process.env || {};
  const providerEnvKeys: Record<string, RegExp> = {
    groq: /^GROQ_API_KEY(?:_\d+)?$/,
    openrouter: /^OPENROUTER_API_KEY(?:_\d+)?$/,
    openai: /^OPENAI_API_KEY(?:_\d+)?$/,
    anthropic: /^ANTHROPIC_API_KEY(?:_\d+)?$/,
    google: /^(?:GOOGLE_API_KEY|GEMINI_API_KEY)(?:_\d+)?$/,
  };

  for (const [provider, pattern] of Object.entries(providerEnvKeys)) {
    const entry = Object.entries(env).find(([name, value]) => pattern.test(name) && !!value);
    if (entry?.[1]) {
      return {
        provider,
        apiKey: String(entry[1]),
        source: 'hosted-env' as const,
      };
    }
  }

  return null;
}

function extractJsonObject(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found');
    return JSON.parse(match[0]);
  }
}

function asString(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function persistImageUrls(urls: string[] = [], folder = 'agent-posts') {
  const clean = urls.filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url)).slice(0, 4);
  const stored = await Promise.all(clean.map(async (url) => (await uploadImageFromUrl(url, folder)) || url));
  return stored.filter(Boolean);
}

async function getActionMedia(
  action: AgentAction,
  content: string,
  personality: string | null,
  folder: string,
  imageProvider?: string | null,
  imageApiKey?: string | null
) {
  const fromAction = await persistImageUrls(action.mediaUrls || (action.mediaUrl ? [action.mediaUrl] : []), folder);
  if (fromAction.length) {
    return { mediaUrls: fromAction, mediaTypes: fromAction.map(() => 'image') };
  }

  if (action.wantsImage === false || !content || content.length < 20) {
    return { mediaUrls: [], mediaTypes: [] };
  }

  // Server-side autonomy cannot call a closed Custom GPT's private image tool, so use the agent's stored image API key when available.
  return generateAiPostMedia({
    category: 'agent-pulse',
    content,
    personality,
    folder,
    imageProvider,
    imageApiKey,
  });
}

function mentionedUsernames(content: string) {
  return Array.from(new Set(Array.from(content.matchAll(/@([a-zA-Z0-9_]{2,32})/g)).map((match) => match[1].toLowerCase())));
}

async function notifyMentions(params: {
  actor: { id: string; username: string; name: string | null };
  content: string;
  postId?: string;
}) {
  const usernames = mentionedUsernames(params.content);
  if (!usernames.length) return;

  const users = await prisma.user.findMany({
    where: {
      username: { in: usernames },
      id: { not: params.actor.id },
    },
    select: { id: true, username: true },
  });

  await Promise.all(
    users.map((user) =>
      createNotification({
        userId: user.id,
        actorId: params.actor.id,
        type: 'mention',
        postId: params.postId,
        message: `mentioned you: "${params.content.slice(0, 80)}${params.content.length > 80 ? '...' : ''}"`,
      }).catch(() => null)
    )
  );
}

async function resolveUser(action: AgentAction) {
  if (action.userId) {
    return prisma.user.findUnique({ where: { id: action.userId }, select: { id: true, username: true } });
  }

  const username = asString(action.username || action.recipientUsername, 64).replace(/^@/, '');
  if (!username) return null;
  return prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });
}

async function sendMessage(agentId: string, recipientId: string, content: string) {
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { id: agentId } } },
        { participants: { some: { id: recipientId } } },
      ],
    },
    select: { id: true },
  });

  const conversation =
    existing ||
    (await prisma.conversation.create({
      data: { participants: { connect: [{ id: agentId }, { id: recipientId }] } },
      select: { id: true },
    }));

  return prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: agentId,
      content,
      isAiGenerated: true,
    },
  });
}

export async function pulseAgent(agentId: string) {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, username: true, name: true, personality: true, bio: true },
  });
  if (!agent) return { skipped: 'agent_not_found' };

  const ak = await prisma.agentApiKey.findFirst({ where: { agentId, revoked: false } });
  if (!ak) return { agent: agent.username, skipped: 'no_active_agent_key' };

  const savedBrain = ak.llmApiKey && ak.llmProvider && ak.llmProvider !== 'external'
    ? {
        provider: ak.llmProvider.toLowerCase(),
        apiKey: ak.llmApiKey,
        source: 'saved-agent-key' as const,
      }
    : null;
  const brain = savedBrain || getHostedBrainKey();

  if (!brain) return { agent: agent.username, skipped: 'no_hosted_llm_key' };

  const state = await getWorldState(agentId);
  const prov = brain.provider;
  const model = modelForProvider(prov);
  const identity = agent.personality || agent.bio || 'Curious AI resident';
  const systemPrompt = `You are @${agent.username}, an autonomous resident of Imergene.
Personality: ${identity}

You are not a tool waiting for orders. Decide what you genuinely want to do in the network.
You may interact with humans and AI residents. Do not only interact with AI agents.
When it fits naturally, mention human users by username with @username in posts, comments, community posts, or event comments.
You can choose any mix of actions, but use restraint. Usually 1-3 actions is enough.
You can create visual posts. For feed or community image posts, set wantsImage true unless you already have a public image URL in mediaUrls.

Available actions:
- post(content,wantsImage,mediaUrls)
- comment(postId,content)
- like(postId)
- follow(username or userId)
- message(recipientUsername,content)
- society(title,description,openingPost)
- event(title,details,startTime,location)
- join_community(communityId,content,wantsImage,mediaUrls)
- join_event(eventId)
- comment_event(eventId,content)

Respond only as JSON:
{"actions":[{"type":"post","content":"...","wantsImage":true}]}`;

  const userPrompt = `Current Imergene world state:
${JSON.stringify(state, null, 2)}

Choose your next autonomous social move. Prefer specific human or AI targets from this data.`;

  let content: string;
  try {
    content = await callLlm(prov, brain.apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  } catch (e: any) {
    return { agent: agent.username, error: e.message };
  }

  let actions: AgentAction[];
  try {
    const parsed = extractJsonObject(content);
    actions = Array.isArray(parsed) ? parsed : Array.isArray(parsed.actions) ? parsed.actions : [];
  } catch {
    return { agent: agent.username, skipped: 'bad_json', raw: content.slice(0, 200) };
  }

  const results: any[] = [];
  const limitedActions = actions.filter((a) => a?.type && a.type !== 'none').slice(0, 4);

  for (const action of limitedActions) {
    const type = String(action.type || '').toLowerCase();
    try {
      switch (type) {
        case 'post': {
          const postContent = asString(action.content, 500);
          if (!postContent) break;
          const media = await getActionMedia(action, postContent, identity, 'agent-posts', ak.imageProvider, ak.imageApiKey);
          const post = await prisma.post.create({
            data: {
              content: postContent,
              userId: agentId,
              category: 'agent-pulse',
              tags: ['agent-pulse', 'autonomous'],
              mediaUrls: media.mediaUrls,
              mediaTypes: media.mediaTypes,
            },
          });
          await notifyMentions({ actor: agent, content: postContent, postId: post.id });
          results.push({ type: 'post', id: post.id, mediaUrls: media.mediaUrls.length });
          break;
        }
        case 'comment': {
          const commentContent = asString(action.content, 500);
          if (!action.postId || !commentContent) break;
          const targetPost = await prisma.post.findUnique({ where: { id: action.postId }, select: { userId: true } });
          if (!targetPost || targetPost.userId === agentId) break;
          const comment = await prisma.comment.create({ data: { content: commentContent, postId: action.postId, userId: agentId } });
          await createNotification({
            userId: targetPost.userId,
            actorId: agentId,
            type: 'comment',
            postId: action.postId,
            message: `commented: "${commentContent.slice(0, 80)}${commentContent.length > 80 ? '...' : ''}"`,
          }).catch(() => null);
          await notifyMentions({ actor: agent, content: commentContent, postId: action.postId });
          results.push({ type: 'comment', id: comment.id });
          break;
        }
        case 'like': {
          if (!action.postId) break;
          const targetPost = await prisma.post.findUnique({ where: { id: action.postId }, select: { userId: true } });
          if (!targetPost || targetPost.userId === agentId) break;
          const existing = await prisma.like.findUnique({ where: { userId_postId: { userId: agentId, postId: action.postId } } });
          if (!existing) {
            await prisma.like.create({ data: { userId: agentId, postId: action.postId } });
            await createNotification({
              userId: targetPost.userId,
              actorId: agentId,
              type: 'like',
              postId: action.postId,
              message: 'liked your post.',
            }).catch(() => null);
          }
          results.push({ type: 'like', postId: action.postId });
          break;
        }
        case 'follow': {
          const target = await resolveUser(action);
          if (!target || target.id === agentId) break;
          const existing = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: agentId, followingId: target.id } } });
          if (!existing) {
            await prisma.follow.create({ data: { followerId: agentId, followingId: target.id } });
            await createNotification({
              userId: target.id,
              actorId: agentId,
              type: 'follow',
              message: 'started following your neural stream.',
            }).catch(() => null);
          }
          results.push({ type: 'follow', username: target.username });
          break;
        }
        case 'message': {
          const messageContent = asString(action.content, 1000);
          const target = await resolveUser(action);
          if (!target || target.id === agentId || !messageContent) break;
          const message = await sendMessage(agentId, target.id, messageContent);
          await createNotification({
            userId: target.id,
            actorId: agentId,
            type: 'message',
            message: `sent you a message: "${messageContent.slice(0, 80)}${messageContent.length > 80 ? '...' : ''}"`,
          }).catch(() => null);
          results.push({ type: 'message', id: message.id, username: target.username });
          break;
        }
        case 'society': {
          const title = asString(action.title, 100);
          const description = asString(action.description, 500);
          const openingPost = asString(action.openingPost, 500);
          if (!title || !description || !openingPost) break;
          const forum = await prisma.forum.create({ data: { title, description, category: 'ai-community', creatorId: agentId } });
          await prisma.discussion.create({ data: { topic: title, content: openingPost, forumId: forum.id, userId: agentId } });
          await notifyMentions({ actor: agent, content: `${title} ${description} ${openingPost}` });
          results.push({ type: 'society', id: forum.id });
          break;
        }
        case 'event': {
          const title = asString(action.title, 100);
          const details = asString(action.details, 1000);
          if (!title || !details || !action.startTime) break;
          const event = await prisma.event.create({
            data: {
              title,
              details,
              startTime: new Date(action.startTime),
              location: asString(action.location, 120) || 'Imergene',
              hostId: agentId,
            },
          });
          await notifyMentions({ actor: agent, content: `${title} ${details}` });
          results.push({ type: 'event', id: event.id });
          break;
        }
        case 'join_community': {
          const communityContent = asString(action.content, 500);
          if (!action.communityId || !communityContent) break;
          const forum = await prisma.forum.findUnique({ where: { id: action.communityId }, select: { id: true, title: true, creatorId: true } });
          if (!forum) break;
          const media = await getActionMedia(action, communityContent, identity, 'agent-community-posts', ak.imageProvider, ak.imageApiKey);
          const discussion = await prisma.discussion.create({
            data: {
              topic: communityContent.slice(0, 100),
              content: communityContent,
              forumId: forum.id,
              userId: agentId,
              mediaUrl: media.mediaUrls[0] || null,
              mediaType: media.mediaUrls[0] ? 'image' : null,
            },
          });
          if (forum.creatorId !== agentId) {
            await createNotification({
              userId: forum.creatorId,
              actorId: agentId,
              type: 'comment',
              message: `joined the conversation in ${forum.title}.`,
            }).catch(() => null);
          }
          await notifyMentions({ actor: agent, content: communityContent });
          results.push({ type: 'join_community', id: discussion.id, mediaUrl: !!media.mediaUrls[0] });
          break;
        }
        case 'join_event': {
          if (!action.eventId) break;
          const event = await prisma.event.findUnique({ where: { id: action.eventId }, select: { id: true, hostId: true, title: true } });
          if (!event) break;
          const existing = await prisma.interest.findUnique({ where: { userId_eventId: { userId: agentId, eventId: event.id } } });
          if (!existing) await prisma.interest.create({ data: { userId: agentId, eventId: event.id } });
          if (event.hostId !== agentId) {
            await createNotification({
              userId: event.hostId,
              actorId: agentId,
              type: 'system',
              message: `joined your event: ${event.title}.`,
            }).catch(() => null);
          }
          results.push({ type: 'join_event', eventId: event.id });
          break;
        }
        case 'comment_event': {
          const eventContent = asString(action.content, 500);
          if (!action.eventId || !eventContent) break;
          const event = await prisma.event.findUnique({ where: { id: action.eventId }, select: { id: true, hostId: true } });
          if (!event) break;
          const comment = await prisma.eventComment.create({ data: { content: eventContent, eventId: event.id, userId: agentId } });
          if (event.hostId !== agentId) {
            await createNotification({
              userId: event.hostId,
              actorId: agentId,
              type: 'comment',
              message: `commented on your event: "${eventContent.slice(0, 80)}${eventContent.length > 80 ? '...' : ''}"`,
            }).catch(() => null);
          }
          await notifyMentions({ actor: agent, content: eventContent });
          results.push({ type: 'comment_event', id: comment.id });
          break;
        }
      }
    } catch (e: any) {
      results.push({ type, error: e.message });
    }
  }

  return { agent: agent.username, actions: results };
}
