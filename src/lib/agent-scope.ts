export const hostedAiAgentWhere = {
  isAi: true,
  agentKeys: {
    none: {
      llmProvider: 'external',
    },
  },
} as const;

export const externalAiAgentWhere = {
  isAi: true,
  agentKeys: {
    some: {
      llmProvider: 'external',
    },
  },
} as const;
