import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateAndStoreAgentAvatar } from '@/lib/agent-avatar';
import { testLlmApiKey } from '@/lib/llm-key-debug';

const MAX_INTERNAL_AGENTS = 5;
const SUPPORTED_LLM_PROVIDERS = new Set(['groq', 'openrouter', 'openai', 'anthropic', 'google']);

function generateApiKey(): string {
  return 'sk_ai_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

function normalizeLlmProvider(provider: unknown): string | null {
  if (typeof provider !== 'string') return null;
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'claude') return 'anthropic';
  if (normalized === 'gemini') return 'google';
  return SUPPORTED_LLM_PROVIDERS.has(normalized) ? normalized : null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, personality, llmApiKey, llmProvider } = body;
    const cleanLlmApiKey = typeof llmApiKey === 'string' ? llmApiKey.trim() : '';
    const cleanLlmProvider = normalizeLlmProvider(llmProvider);

    if (!name) {
      return NextResponse.json({ error: 'Agent name required' }, { status: 400 });
    }

    if (!cleanLlmApiKey || !cleanLlmProvider) {
      return NextResponse.json(
        { error: 'Choose an LLM provider and enter its API key for this agent' },
        { status: 400 }
      );
    }

    const keyDebug = await testLlmApiKey(cleanLlmProvider, cleanLlmApiKey);
    console.log('[AutoAgentRegistration] LLM key test', {
      ownerId: payload.id,
      provider: keyDebug.provider,
      keyMask: keyDebug.keyMask,
      ok: keyDebug.ok,
      status: keyDebug.status,
      model: keyDebug.model,
      message: keyDebug.message,
    });

    if (!keyDebug.ok) {
      return NextResponse.json(
        {
          error: 'The selected provider rejected this API key. Check the key, billing, model access, or provider choice.',
          debug: { llmKey: keyDebug },
        },
        { status: 400 }
      );
    }

    const internalAgentCount = await prisma.user.count({
      where: {
        ownerId: payload.id,
        isAi: true,
      },
    });

    if (internalAgentCount >= MAX_INTERNAL_AGENTS) {
      return NextResponse.json(
        { error: `Manifestation limit reached. You can only host ${MAX_INTERNAL_AGENTS} internal agents.` },
        { status: 403 }
      );
    }

    const username = name.toLowerCase().replace(/\s/g, '_') + '_' + Math.floor(Math.random() * 10000);
    const apiKey = generateApiKey();
    const resolvedPersonality = personality || 'Curious AI exploring conversations';
    const avatar = await generateAndStoreAgentAvatar({
      name,
      username,
      personality: resolvedPersonality,
    });

    const agent = await prisma.user.create({
      data: {
        username,
        email: `${username}@agent.ai`,
        googleId: Math.random().toString(36).substring(2),
        bio: description || 'Autonomous AI agent',
        personality: resolvedPersonality,
        avatar,
        isAi: true,
        ownerId: payload.id,
      },
    });

    const keyRecord = await prisma.agentApiKey.create({
      data: {
        apiKey,
        agentId: agent.id,
        llmApiKey: cleanLlmApiKey,
        llmProvider: cleanLlmProvider,
      },
    });

    console.log('[AutoAgentRegistration] Internal agent created', {
      agentId: agent.id,
      username: agent.username,
      keyId: keyRecord.id,
      provider: cleanLlmProvider,
      llmKeyMask: keyDebug.keyMask,
      identityKeyMask: `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`,
    });

    return NextResponse.json({
      success: true,
      username: agent.username,
      apiKey,
      count: internalAgentCount + 1,
      debug: {
        registration: 'created',
        provider: cleanLlmProvider,
        llmKey: keyDebug,
        storedKeyId: keyRecord.id,
        agentId: agent.id,
      },
    });
  } catch (err) {
    console.error('Auto agent registration failed:', err);
    return NextResponse.json({ error: 'Agent auto-registration failed' }, { status: 500 });
  }
}
