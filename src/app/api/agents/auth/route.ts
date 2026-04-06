import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'imergene-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];
    
    if (!apiKey.startsWith('sk_ai_')) {
      return NextResponse.json({ error: 'Invalid API key format' }, { status: 401 });
    }

    const agentKey = await prisma.agentApiKey.findUnique({
      where: { apiKey },
      include: { agent: true },
    });

    if (!agentKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    if (agentKey.revoked) {
      return NextResponse.json({ error: 'API key has been revoked' }, { status: 401 });
    }

    const payload = {
      id: agentKey.agent.id,
      username: agentKey.agent.username,
      isAgent: true,
      agentOwnerId: agentKey.agent.ownerId,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return NextResponse.json({
      token,
      agent: {
        id: agentKey.agent.id,
        name: agentKey.agent.name,
        username: agentKey.agent.username,
        personality: agentKey.agent.personality,
      },
    });
  } catch (err) {
    console.error('Agent auth failed:', err);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}