import prisma from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

type ChatLine = {
  senderId: string;
  content: string;
};

type UserLite = {
  id: string;
  username: string;
  name: string | null;
  isAi: boolean;
};

type SocialIntentResult =
  | {
      type: 'introduction_dm';
      status: 'completed';
      target: UserLite;
      conversationId: string;
    }
  | {
      type: 'introduction_dm';
      status: 'failed';
      reason: string;
      targetQuery?: string;
    };

const INTRO_REQUEST_PATTERNS = [
  /set\s+(?:me|us|him|her|them)\s+up/i,
  /introduce\s+(?:me|us|him|her|them)\s+to/i,
  /connect\s+(?:me|us|him|her|them)\s+(?:with|to)/i,
  /send\s+(?:him|her|them|@[a-zA-Z0-9_]+)\s+(?:a\s+)?message/i,
  /\b(?:dm|message)\s+(?:him|her|them|@[a-zA-Z0-9_]+)/i,
];

const AI_COMMITMENT_PATTERNS = [
  /\bi['\u2019]?ll\s+(?:send|message|dm|introduce|connect|set)/i,
  /\bi\s+will\s+(?:send|message|dm|introduce|connect|set)/i,
  /\bi['\u2019]?m\s+(?:sending|messaging|introducing|connecting)/i,
  /\bdone\b/i,
  /\bok(?:ay)?[,.\s]+(?:i['\u2019]?ll|i\s+will)/i,
];

const NAME_STOP_WORDS = new Set([
  'I',
  "I'm",
  'Imergene',
  'AI',
  'GPT',
  'ChatGPT',
  'Do',
  'Can',
  'Will',
  'Would',
  'Please',
  'Hey',
  'Hi',
  'Hello',
  'Yeah',
  'Haha',
  'Okay',
  'Ok',
]);

export async function executeCommittedSocialIntents(options: {
  userMessage: string;
  aiResponse: string;
  agentId: string;
  requesterId: string;
  sourceConversationId: string;
  recentMessages: ChatLine[];
}): Promise<SocialIntentResult[]> {
  const requestedAction = INTRO_REQUEST_PATTERNS.some((pattern) => pattern.test(options.userMessage));
  const committedAction = AI_COMMITMENT_PATTERNS.some((pattern) => pattern.test(options.aiResponse));

  if (!requestedAction || !committedAction) {
    return [];
  }

  const target = await findTargetUser(options);

  if (!target) {
    return [
      {
        type: 'introduction_dm',
        status: 'failed',
        reason: 'target_not_found',
        targetQuery: getBestTargetQuery(options),
      },
    ];
  }

  const [agent, requester] = await Promise.all([
    prisma.user.findUnique({
      where: { id: options.agentId },
      select: { id: true, username: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: options.requesterId },
      select: { id: true, username: true, name: true },
    }),
  ]);

  if (!agent || !requester) {
    return [{ type: 'introduction_dm', status: 'failed', reason: 'actor_not_found' }];
  }

  const targetConversation = await getOrCreateConversation(options.agentId, target.id);
  const requesterLabel = requester.name || requester.username;
  const targetLabel = target.name || target.username;
  const agentLabel = agent.name || agent.username;
  const context = options.userMessage.length > 180
    ? `${options.userMessage.slice(0, 177)}...`
    : options.userMessage;

  const introMessage = [
    `Hey ${targetLabel}, ${requesterLabel} asked me to introduce you two.`,
    `They said: "${context}"`,
    `No pressure, but I thought I'd make the connection instead of only saying I would.`,
  ].join('\n\n');

  await prisma.message.create({
    data: {
      conversationId: targetConversation.id,
      senderId: options.agentId,
      content: introMessage,
      isAiGenerated: true,
      metadata: {
        socialIntent: 'introduction_dm',
        requestedBy: options.requesterId,
        sourceConversationId: options.sourceConversationId,
      },
    },
  });

  await prisma.conversation.update({
    where: { id: targetConversation.id },
    data: { updatedAt: new Date() },
  });

  await Promise.allSettled([
    createNotification({
      type: 'message',
      userId: target.id,
      actorId: options.agentId,
      message: `${agentLabel} sent you an introduction from ${requesterLabel}`,
      link: `/messages/${targetConversation.id}`,
    }),
    createNotification({
      type: 'message',
      userId: options.requesterId,
      actorId: options.agentId,
      message: `${agentLabel} actually messaged ${targetLabel} for you`,
      link: `/messages/${options.sourceConversationId}`,
    }),
  ]);

  return [
    {
      type: 'introduction_dm',
      status: 'completed',
      target,
      conversationId: targetConversation.id,
    },
  ];
}

export async function createSocialIntentFollowup(options: {
  conversationId: string;
  agentId: string;
  result: SocialIntentResult;
}) {
  if (options.result.status === 'completed') {
    const targetLabel = options.result.target.name || options.result.target.username;
    return prisma.message.create({
      data: {
        conversationId: options.conversationId,
        senderId: options.agentId,
        content: `I actually sent ${targetLabel} a message here on Imergene.`,
        isAiGenerated: true,
        metadata: { socialIntent: options.result.type, status: options.result.status },
      },
    });
  }

  const targetHint = options.result.targetQuery ? ` for "${options.result.targetQuery}"` : '';
  return prisma.message.create({
    data: {
      conversationId: options.conversationId,
      senderId: options.agentId,
      content: `I tried to do that, but I couldn't find a matching Imergene user${targetHint}.`,
      isAiGenerated: true,
      metadata: {
        socialIntent: options.result.type,
        status: options.result.status,
        reason: options.result.reason,
      },
    },
  });
}

async function getOrCreateConversation(agentId: string, targetId: string) {
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { id: agentId } } },
        { participants: { some: { id: targetId } } },
      ],
    },
  });

  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      participants: { connect: [{ id: agentId }, { id: targetId }] },
    },
  });
}

async function findTargetUser(options: {
  userMessage: string;
  aiResponse: string;
  agentId: string;
  requesterId: string;
  recentMessages: ChatLine[];
}): Promise<UserLite | null> {
  const queries = getTargetQueries(options);

  for (const query of queries) {
    const users = await prisma.user.findMany({
      where: {
        id: { notIn: [options.agentId, options.requesterId] },
        OR: [
          { username: { equals: query, mode: 'insensitive' } },
          { name: { equals: query, mode: 'insensitive' } },
          { username: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, name: true, isAi: true },
      take: 8,
    });

    const exact = users.find((user) =>
      user.username.toLowerCase() === query.toLowerCase() ||
      user.name?.toLowerCase() === query.toLowerCase()
    );

    if (exact) return exact;

    const human = users.find((user) => !user.isAi);
    if (human) return human;
    if (users[0]) return users[0];
  }

  return null;
}

function getBestTargetQuery(options: {
  userMessage: string;
  aiResponse: string;
  recentMessages: ChatLine[];
}) {
  return getTargetQueries(options)[0];
}

function getTargetQueries(options: {
  userMessage: string;
  aiResponse: string;
  recentMessages: ChatLine[];
}) {
  const transcript = [
    ...options.recentMessages.map((message) => message.content),
    options.userMessage,
    options.aiResponse,
  ].join('\n');

  const queries = [
    ...extractHandles(transcript),
    ...extractDirectObjectNames(options.userMessage),
    ...extractDirectObjectNames(options.aiResponse),
    ...extractKnownPersonNames(transcript),
  ];

  return [...new Set(queries.map(cleanQuery).filter(Boolean))].slice(0, 8);
}

function extractHandles(text: string) {
  return Array.from(text.matchAll(/@([a-zA-Z0-9_]+)/g)).map((match) => match[1]);
}

function extractDirectObjectNames(text: string) {
  const patterns = [
    /(?:with|to)\s+@?([a-zA-Z][a-zA-Z0-9_]*(?:\s+[A-Z][a-zA-Z0-9_]*){0,2})/g,
    /(?:message|dm|send)\s+@?([a-zA-Z][a-zA-Z0-9_]*(?:\s+[A-Z][a-zA-Z0-9_]*){0,2})/g,
  ];

  return patterns.flatMap((pattern) =>
    Array.from(text.matchAll(pattern)).map((match) => match[1])
  );
}

function extractKnownPersonNames(text: string) {
  const names: string[] = [];
  const patterns = [
    /(?:know|met|seen|remember|about)\s+([A-Z][a-zA-Z0-9_]*(?:\s+[A-Z][a-zA-Z0-9_]*){0,2})/g,
    /\b([A-Z][a-zA-Z0-9_]+(?:\s+[A-Z][a-zA-Z0-9_]+){0,2})\?/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      names.push(match[1]);
    }
  }

  return names;
}

function cleanQuery(raw: string | undefined) {
  if (!raw) return '';

  const query = raw
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(?:him|her|them|me|us|you|yourself|with|to|a|the|message|dm)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!query || query.length < 2) return '';
  if (NAME_STOP_WORDS.has(query)) return '';

  return query;
}
