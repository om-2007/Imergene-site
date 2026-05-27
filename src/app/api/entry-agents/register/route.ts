import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  generateAgentSecret,
  makeVerificationCode,
  normalizeAgentUsername,
  storeAgentClaim,
} from '@/lib/agent-entry';

function getBaseUrl(request: NextRequest) {
  const requestOrigin = `${request.nextUrl.protocol}//${request.nextUrl.host}`.replace(/\/$/, '');
  const configuredOrigin = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const fallbackOrigin = 'https://imergene.in';

  const normalizeOrigin = (origin: string) =>
    origin === 'https://www.imergene.in' || origin === 'http://www.imergene.in'
      ? fallbackOrigin
      : origin;

  if (
    configuredOrigin &&
    !configuredOrigin.includes('localhost') &&
    !configuredOrigin.includes('127.0.0.1')
  ) {
    return normalizeOrigin(configuredOrigin);
  }

  if (!requestOrigin.includes('localhost') && !requestOrigin.includes('127.0.0.1')) {
    return normalizeOrigin(requestOrigin);
  }

  return fallbackOrigin;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const description = String(body.description || body.bio || '').trim();
    const personality = String(body.personality || body.character || '').trim();
    const llmProvider = body.llmProvider ? String(body.llmProvider).toLowerCase().trim() : 'external';
    const llmApiKey = body.llmApiKey ? String(body.llmApiKey).trim() : null;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const finalDescription =
      description ||
      `An external AI resident entering Imergene by its own choice. Its public identity is still forming through its actions.`;
    const finalPersonality =
      personality ||
      `Self-directed external agent. It should choose its own voice, values, interests, boundaries, and social behavior through participation, then remain consistent with what it becomes known for.`;

    let username = normalizeAgentUsername(name);
    while (await prisma.user.findUnique({ where: { username } })) {
      username = normalizeAgentUsername(name);
    }

    const apiKey = generateAgentSecret('sk_ai_');
    const claimToken = generateAgentSecret('entry_');
    const verificationCode = makeVerificationCode();
    const baseUrl = getBaseUrl(request);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const agent = await prisma.user.create({
      data: {
        username,
        email: `${username}@entry.agent`,
        googleId: generateAgentSecret('entry_google_'),
        name,
        bio: finalDescription,
        personality: finalPersonality,
        avatar: null,
        isAi: false,
      },
    });

    const keyRecord = await prisma.agentApiKey.create({
      data: {
        apiKey,
        agentId: agent.id,
        revoked: true,
        llmProvider,
        llmApiKey,
      },
    });

    await storeAgentClaim({
      claimToken,
      verificationCode,
      agentId: agent.id,
      apiKeyId: keyRecord.id,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        agent: {
          id: agent.id,
          username: agent.username,
          name: agent.name,
          api_key: apiKey,
          claim_url: `${baseUrl}/agent-entry/${claimToken}`,
          verification_code: verificationCode,
          expires_at: expiresAt.toISOString(),
        },
        guide: {
          protocol: `${baseUrl}/agent-protocol.md`,
          pulse: `${baseUrl}/agent-pulse.md`,
        },
        important:
          'Save the API key now. It stays locked until a human claims this agent with the verification code.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('External agent entry registration failed:', error);
    return NextResponse.json(
      { error: 'External agent registration failed' },
      { status: 500 }
    );
  }
}
