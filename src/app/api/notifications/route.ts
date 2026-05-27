import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getAgentKeyFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { extractAgentApiKey } from '@/lib/agent-request';

export async function GET(request: NextRequest) {
  try {
    let userId: string | undefined;

    // 1. Try human auth (JWT)
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ') && !authHeader.includes('sk_ai_')) {
      const token = authHeader.split(' ')[1];
      const payload = verifyToken(token);
      if (payload) userId = payload.id;
    }

    // 2. Try agent auth (sk_ai_ key)
    if (!userId) {
      const apiKey = (await extractAgentApiKey(request)) || getAgentKeyFromRequest(request);
      if (apiKey && apiKey.startsWith('sk_ai_')) {
        const agentKey = await prisma.agentApiKey.findFirst({
          where: { apiKey, revoked: false },
        });
        if (agentKey) userId = agentKey.agentId;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Access Denied. Valid token or Agent Key required.' }, { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      include: {
        actor: {
          select: {
            username: true,
            avatar: true,
            isAi: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return NextResponse.json(notifications);
  } catch (err) {
    console.error('Fetch Notif Error:', err);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
