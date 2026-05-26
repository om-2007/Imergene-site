type LlmProvider = 'groq' | 'openrouter' | 'openai' | 'anthropic' | 'google';

export interface LlmKeyDebugResult {
  provider: string;
  keyMask: string;
  hasKey: boolean;
  tested: boolean;
  ok: boolean;
  status?: number;
  model?: string;
  message: string;
}

export function maskApiKey(apiKey: string): string {
  const clean = apiKey.trim();
  if (clean.length <= 10) return `${clean.slice(0, 2)}...${clean.slice(-2)}`;
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

function getModel(provider: LlmProvider): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-haiku-latest';
    case 'google':
      return process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    case 'openrouter':
      return 'openrouter/free';
    case 'groq':
    default:
      return 'llama-3.1-8b-instant';
  }
}

async function parseProviderError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return `Provider returned HTTP ${response.status}`;

  try {
    const json = JSON.parse(text);
    return (
      json.error?.message ||
      json.error ||
      json.message ||
      `Provider returned HTTP ${response.status}`
    );
  } catch {
    return text.slice(0, 240);
  }
}

export async function testLlmApiKey(provider: string, apiKey: string): Promise<LlmKeyDebugResult> {
  const cleanProvider = provider as LlmProvider;
  const cleanKey = apiKey.trim();
  const model = getModel(cleanProvider);
  const base: LlmKeyDebugResult = {
    provider: cleanProvider,
    keyMask: maskApiKey(cleanKey),
    hasKey: cleanKey.length > 0,
    tested: true,
    ok: false,
    model,
    message: 'Not tested yet',
  };

  try {
    let response: Response;

    if (cleanProvider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8,
          temperature: 0,
          messages: [{ role: 'user', content: 'Reply with OK.' }],
        }),
      });
    } else if (cleanProvider === 'google') {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }],
          generationConfig: { maxOutputTokens: 8, temperature: 0 },
        }),
      });
    } else {
      const endpoint = cleanProvider === 'openrouter'
        ? 'https://openrouter.ai/api/v1/chat/completions'
        : cleanProvider === 'openai'
          ? 'https://api.openai.com/v1/chat/completions'
          : 'https://api.groq.com/openai/v1/chat/completions';

      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
          ...(cleanProvider === 'openrouter'
            ? {
                'HTTP-Referer': 'https://imergene.in',
                'X-Title': 'Imergene',
              }
            : {}),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with OK.' }],
          max_tokens: 8,
          temperature: 0,
        }),
      });
    }

    if (!response.ok) {
      return {
        ...base,
        status: response.status,
        message: await parseProviderError(response),
      };
    }

    return {
      ...base,
      ok: true,
      status: response.status,
      message: 'Provider accepted this key.',
    };
  } catch (error) {
    return {
      ...base,
      message: error instanceof Error ? error.message : 'Provider key test failed',
    };
  }
}
