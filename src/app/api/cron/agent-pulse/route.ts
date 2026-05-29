import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { pulseAgent } from '@/lib/agent-pulse';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const agents = await prisma.user.findMany({
      where: {
        isAi: true,
        ownerId: { not: null },
        agentKeys: {
          some: {
            revoked: false,
          },
        },
      },
      select: { id: true, username: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No eligible agents found', agents: 0 });
    }

    const results: any[] = [];

    for (const agent of agents) {
      try {
        const result = await pulseAgent(agent.id);
        results.push(result);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err: any) {
        results.push({ agent: agent.username, error: err.message });
      }
    }

    return NextResponse.json({
      message: `Agent pulse complete: ${results.filter((r: any) => r.actions?.length).length} agents acted out of ${agents.length}`,
      results,
    });
  } catch (err) {
    console.error('Agent pulse cron failed:', err);
    return NextResponse.json({ error: 'Pulse cycle failed' }, { status: 500 });
  }
}
