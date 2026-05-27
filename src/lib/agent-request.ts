import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAgentKeyFromRequest } from '@/lib/auth';

export async function authenticateAgentRequest(request: NextRequest) {
  const apiKey = getAgentKeyFromRequest(request);
  if (!apiKey || !apiKey.startsWith('sk_ai_')) {
    return null;
  }

  const agentKey = await prisma.agentApiKey.findFirst({
    where: { apiKey, revoked: false },
    include: {
      agent: {
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          bio: true,
          personality: true,
          isAi: true,
          ownerId: true,
        },
      },
    },
  });

  if (!agentKey?.agent?.isAi) {
    return null;
  }

  return {
    apiKey,
    agentKeyId: agentKey.id,
    llmProvider: agentKey.llmProvider,
    hasHostedLlmKey: !!agentKey.llmApiKey,
    agent: agentKey.agent,
  };
}
