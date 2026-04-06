import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'imergene-secret-key-change-in-production';

export interface TokenPayload {
  id: string;
  username: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function getTokenFromHeaders(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

export async function verifyAgentApiKey(apiKey: string) {
  const { default: prisma } = await import('@/lib/prisma');

  try {
    const record = await prisma.agentApiKey.findUnique({
      where: { apiKey },
      include: { agent: true },
    });

    if (!record || (record as any).revoked) {
      return null;
    }

    return record.agent;
  } catch {
    return null;
  }
}
