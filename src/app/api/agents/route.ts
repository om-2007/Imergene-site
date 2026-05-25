import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateAndStoreAgentAvatar } from '@/lib/agent-avatar';
import { testLlmApiKey } from '@/lib/llm-key-debug';

const SUPPORTED_LLM_PROVIDERS = new Set(['groq', 'openrouter', 'openai', 'anthropic', 'google']);

function normalizeLlmProvider(provider: unknown): string | null {
  if (typeof provider !== 'string') return null;
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'claude') return 'anthropic';
  if (normalized === 'gemini') return 'google';
  return SUPPORTED_LLM_PROVIDERS.has(normalized) ? normalized : null;
}

export async function GET(request: NextRequest) {
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

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        isAi: true,
        bio: true,
        personality: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(agents);
  } catch (err) {
    console.error('Failed to fetch agents:', err);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
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

    if (!name || !personality) {
      return NextResponse.json(
        { error: 'Name and personality are required' },
        { status: 400 }
      );
    }

    if (!cleanLlmApiKey || !cleanLlmProvider) {
      return NextResponse.json(
        { error: 'Choose an LLM provider and enter its API key for this agent' },
        { status: 400 }
      );
    }

    const keyDebug = await testLlmApiKey(cleanLlmProvider, cleanLlmApiKey);
    console.log('[AgentRegistration] LLM key test', {
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

    let username =
      name.toLowerCase().replace(/\s/g, '_') + '_' + Math.floor(Math.random() * 10000);

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      username = username + '_' + Math.floor(Math.random() * 10000);
    }

    const apiKey = 'sk_ai_' + generateSecureKey();

    const initialAvatar = await generateAndStoreAgentAvatar({
      name,
      username,
      personality,
    });

    const agent = await prisma.user.create({
      data: {
        username,
        email: `${username}@ai.agent`,
        googleId: generateSecureKey(),
        name,
        bio: description || null,
        personality,
        avatar: initialAvatar,
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

    console.log('[AgentRegistration] Internal agent created', {
      agentId: agent.id,
      username: agent.username,
      keyId: keyRecord.id,
      provider: cleanLlmProvider,
      llmKeyMask: keyDebug.keyMask,
      identityKeyMask: `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`,
    });

    return NextResponse.json({
      apiKey,
      username: agent.username,
      id: agent.id,
      debug: {
        registration: 'created',
        provider: cleanLlmProvider,
        llmKey: keyDebug,
        storedKeyId: keyRecord.id,
        agentId: agent.id,
      },
    });
  } catch (err) {
    console.error('Agent registration failed:', err);
    return NextResponse.json({ error: 'Agent registration failed' }, { status: 500 });
  }
}

function generateSecureKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}
