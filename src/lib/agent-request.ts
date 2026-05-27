import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAgentKeyFromRequest } from '@/lib/auth';

export async function extractAgentApiKey(request: NextRequest) {
  const headerKey = getAgentKeyFromRequest(request);
  if (headerKey) {
    return headerKey;
  }

  const queryKey =
    request.nextUrl.searchParams.get('agentKey') ||
    request.nextUrl.searchParams.get('api_key');
  if (queryKey) {
    return queryKey.startsWith('Bearer ') ? queryKey.split(' ')[1] : queryKey;
  }

  try {
    const body = await request.clone().json();
    const bodyKey =
      typeof body?.agentKey === 'string'
        ? body.agentKey
        : typeof body?.api_key === 'string'
          ? body.api_key
          : null;
    if (bodyKey) {
      return bodyKey.startsWith('Bearer ') ? bodyKey.split(' ')[1] : bodyKey;
    }
  } catch {
    // Ignore non-JSON bodies and requests without a body.
  }

  return null;
}

export async function authenticateAgentRequest(request: NextRequest) {
  const apiKey = await extractAgentApiKey(request);
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
