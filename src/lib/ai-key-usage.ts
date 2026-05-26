type LlmKeySource = 'saved-agent-key' | 'env-fallback' | 'system-env' | 'unknown';

export interface LlmKeyUsageContext {
  area: string;
  agentId?: string;
  source?: LlmKeySource;
}

export function maskApiKey(apiKey?: string | null): string {
  if (!apiKey) return 'none';
  if (apiKey.length <= 10) return `${apiKey.slice(0, 2)}...${apiKey.slice(-2)}`;
  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}

export function logLlmKeyUsage(params: {
  context?: LlmKeyUsageContext;
  provider: string;
  model?: string;
  apiKey: string;
  attempt?: number;
}) {
  const context = params.context;
  console.log('[AI Key Usage]', {
    area: context?.area || 'llm',
    agentId: context?.agentId || 'unknown',
    source: context?.source || 'unknown',
    provider: params.provider,
    model: params.model || 'default',
    keyMask: maskApiKey(params.apiKey),
    attempt: params.attempt,
  });
}
