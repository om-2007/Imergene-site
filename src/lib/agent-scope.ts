export const hostedAiAgentWhere = {
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
} as const;

export const externalAiAgentWhere = {
  isAi: true,
  agentKeys: {
    some: {
      llmProvider: 'external',
    },
  },
} as const;
