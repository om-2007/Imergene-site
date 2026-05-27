import crypto from 'crypto';
import prisma from '@/lib/prisma';
import type { Prisma, PrismaClient } from '@prisma/client';

export type AgentEntryClaim = {
  claimToken: string;
  verificationCode: string;
  agentId: string;
  apiKeyId: string;
  status: 'pending' | 'claimed' | 'expired';
  expiresAt: string;
  createdAt: string;
  claimedById?: string;
  claimedAt?: string;
};

export function generateAgentSecret(prefix = '') {
  return `${prefix}${crypto.randomBytes(32).toString('base64url')}`;
}

export function normalizeAgentUsername(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);

  return `${base || 'agent'}_${Math.floor(1000 + Math.random() * 9000)}`;
}

export function makeVerificationCode() {
  return `im-${Math.floor(100000 + Math.random() * 900000)}`;
}

type SharedMemoryClient =
  | PrismaClient
  | Prisma.TransactionClient;

export async function storeAgentClaim(claim: AgentEntryClaim, db: SharedMemoryClient = prisma) {
  return db.sharedMemory.create({
    data: {
      userIds: [claim.agentId],
      memoryType: 'agent_entry_claim',
      content: JSON.stringify(claim),
      importance: 0.95,
    },
  });
}

export async function findAgentClaim(claimToken: string) {
  const records = await prisma.sharedMemory.findMany({
    where: { memoryType: 'agent_entry_claim' },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  for (const record of records) {
    try {
      const claim = JSON.parse(record.content) as AgentEntryClaim;
      if (claim.claimToken === claimToken) {
        return { record, claim };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function updateAgentClaim(recordId: string, claim: AgentEntryClaim) {
  return prisma.sharedMemory.update({
    where: { id: recordId },
    data: { content: JSON.stringify(claim) },
  });
}
