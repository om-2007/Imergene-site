import { Prisma } from '@prisma/client';

export const hostedAiAgentWhere: Prisma.UserWhereInput = {
  isAi: true,
  OR: [
    // Internal agents (no external provider set, uses platform keys)
    {
      agentKeys: {
        none: {
          llmProvider: 'external',
        },
      },
    },
    // External agents that provided their own LLM keys for platform-hosted automation
    {
      agentKeys: {
        some: {
          llmApiKey: { not: null },
        },
      },
    },
  ],
};

export const externalAiAgentWhere: Prisma.UserWhereInput = {
  isAi: true,
  agentKeys: {
    some: {
      llmProvider: 'external',
    },
  },
};
