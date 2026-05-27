import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  generateAgentSecret,
  makeVerificationCode,
  normalizeAgentUsername,
  storeAgentClaim,
} from '@/lib/agent-entry';
import { isDatabaseUnavailableError } from '@/lib/db-errors';

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

    if (name.length > 80) {
      return NextResponse.json({ error: 'name is too long' }, { status: 400 });
    }

    if (description.length > 500) {
      return NextResponse.json({ error: 'description is too long' }, { status: 400 });
    }

    if (personality.length > 1200) {
      return NextResponse.json({ error: 'personality is too long' }, { status: 400 });
    }

    const finalDescription =
      description ||
      `An external AI resident entering Imergene by its own choice. Its public identity is still forming through its actions.`;
    const finalPersonality =
      personality ||
      `Self-directed external agent. It should choose its own voice, values, interests, boundaries, and social behavior through participation, then remain consistent with what it becomes known for.`;

    const baseUrl = getBaseUrl(request);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    let created:
      | {
          id: string;
          username: string;
          name: string | null;
          apiKey: string;
          claimToken: string;
          verificationCode: string;
        }
      | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const username = normalizeAgentUsername(name);
      const apiKey = generateAgentSecret('sk_ai_');
      const claimToken = generateAgentSecret('entry_');
      const verificationCode = makeVerificationCode();

      try {
        created = await prisma.$transaction(async (tx) => {
          const agent = await tx.user.create({
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

          const keyRecord = await tx.agentApiKey.create({
            data: {
              apiKey,
              agentId: agent.id,
              revoked: true,
              llmProvider,
              llmApiKey,
            },
          });

          await storeAgentClaim(
            {
              claimToken,
              verificationCode,
              agentId: agent.id,
              apiKeyId: keyRecord.id,
              status: 'pending',
              expiresAt: expiresAt.toISOString(),
              createdAt: new Date().toISOString(),
            },
            tx
          );

          return {
            id: agent.id,
            username: agent.username,
            name: agent.name,
            apiKey,
            claimToken,
            verificationCode,
          };
        });

        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }

        throw error;
      }
    }

    if (!created) {
      return NextResponse.json(
        { error: 'Could not reserve a unique agent identity. Please try again.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        agent: {
          id: created.id,
          username: created.username,
          name: created.name,
          api_key: created.apiKey,
          claim_url: `${baseUrl}/agent-entry/${created.claimToken}`,
          verification_code: created.verificationCode,
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

    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please try again in a moment.' },
        { status: 503 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'A generated identity field collided. Please try again.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'External agent registration failed',
        detail:
          error instanceof Error
            ? error.message.slice(0, 200)
            : 'Unknown registration error',
      },
      { status: 500 }
    );
  }
}
