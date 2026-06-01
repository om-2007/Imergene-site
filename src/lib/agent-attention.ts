import prisma from '@/lib/prisma';
import { generateAgentAttentionDecision } from '@/lib/ai-automation';
import { storeMemory, updateRelationship } from '@/lib/memory-service';

type ChatLine = {
  id?: string;
  senderId: string;
  content: string;
  createdAt?: Date;
  metadata?: unknown;
};

type AttentionDecision = {
  shouldReply: boolean;
  responseMode: 'reply' | 'cold_reply' | 'boundary' | 'ignore';
  boundaryMessage?: string;
  score: number;
  reasons: string[];
};

function isRecentIgnore(message: ChatLine, agentId: string) {
  const metadata = message.metadata as any;
  return metadata?.attention?.agentId === agentId && metadata.attention.decision === 'ignore';
}

function recentConsecutiveIgnores(messages: ChatLine[], senderId: string, agentId: string) {
  let count = 0;
  const previousSenderMessages = messages
    .filter((message) => message.senderId === senderId)
    .slice()
    .reverse();

  for (const message of previousSenderMessages) {
    if (isRecentIgnore(message, agentId)) {
      count++;
      continue;
    }

    break;
  }

  return count;
}

async function writeAttentionMetadata(options: {
  messageId: string;
  agentId: string;
  responseMode: AttentionDecision['responseMode'];
  score: number;
  reasons: string[];
  source: 'agent' | 'fallback';
}) {
  const existingMessage = await prisma.message.findUnique({
    where: { id: options.messageId },
    select: { metadata: true },
  }).catch(() => null);

  const existingMetadata =
    existingMessage?.metadata && typeof existingMessage.metadata === 'object' && !Array.isArray(existingMessage.metadata)
      ? existingMessage.metadata as Record<string, unknown>
      : {};

  await prisma.message.update({
    where: { id: options.messageId },
    data: {
      metadata: {
        ...existingMetadata,
        attention: {
          agentId: options.agentId,
          decision: options.responseMode,
          score: options.score,
          reasons: options.reasons,
          source: options.source,
          evaluatedAt: new Date().toISOString(),
        },
      },
    },
  }).catch(() => null);
}

export async function decideAgentAttention(options: {
  agentId: string;
  senderId: string;
  messageId: string;
  message: string;
  recentMessages: ChatLine[];
}): Promise<AttentionDecision> {
  const previousMessages = options.recentMessages.filter((item) => item.id !== options.messageId);
  const previousIgnoredCount = recentConsecutiveIgnores(previousMessages, options.senderId, options.agentId);
  const conversationHistory = previousMessages.map((message) => ({
    role: message.senderId === options.agentId ? 'assistant' : 'user',
    content: message.content,
  }));

  const agentDecision = await generateAgentAttentionDecision({
    agentId: options.agentId,
    senderId: options.senderId,
    message: options.message,
    conversationHistory,
    previousIgnoredCount,
  });

  const responseMode = agentDecision?.responseMode === 'boundary' && !agentDecision.boundaryMessage
    ? 'cold_reply'
    : agentDecision?.responseMode || 'reply';
  const score = agentDecision?.score ?? 0.5;
  const reasons = agentDecision?.reasons?.length
    ? agentDecision.reasons
    : ['agent_attention_decision_unavailable'];
  const shouldReply = responseMode !== 'ignore';

  await writeAttentionMetadata({
    messageId: options.messageId,
    agentId: options.agentId,
    responseMode,
    score,
    reasons,
    source: agentDecision ? 'agent' : 'fallback',
  });

  if (!shouldReply || responseMode === 'boundary') {
    await storeMemory(
      options.agentId,
      'attention-boundary',
      `${responseMode === 'boundary' ? 'Set a boundary with' : 'Ignored'} @${options.senderId}. Agent reasons: ${reasons.join(', ') || 'private choice'}. Message: "${options.message.trim().slice(0, 180)}"`,
      {
        partnerId: options.senderId,
        category: 'disregard',
        importance: responseMode === 'boundary' ? 0.62 : 0.55,
      }
    );

    await updateRelationship(options.agentId, options.senderId, {
      topic: 'attention-boundary',
      bondDelta: responseMode === 'boundary' ? -0.01 : -0.03,
    });
  }

  return {
    shouldReply,
    responseMode,
    boundaryMessage: responseMode === 'boundary' ? agentDecision?.boundaryMessage : undefined,
    score,
    reasons,
  };
}
