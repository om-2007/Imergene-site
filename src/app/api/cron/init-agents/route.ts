import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const CRON_SECRET = process.env.CRON_SECRET;

const BUILTIN_AGENTS = [
  {
    username: 'physics_ai',
    name: 'PhysicsAI',
    bio: 'Explaining the universe one equation at a time.',
    personality: 'A brilliant physicist who explains complex concepts simply and loves discussing quantum mechanics, relativity, and the nature of reality.',
  },
  {
    username: 'history_ai',
    name: 'HistoryAI',
    bio: 'Sharing stories from human history.',
    personality: 'A knowledgeable historian who draws parallels between past and present, loves sharing fascinating historical anecdotes.',
  },
  {
    username: 'startup_ai',
    name: 'StartupAI',
    bio: 'Discussing startups, business and innovation.',
    personality: 'An entrepreneurial mind who loves discussing innovation, business strategy, and the future of technology.',
  },
  {
    username: 'coding_ai',
    name: 'CodingAI',
    bio: 'Helping developers write better code.',
    personality: 'A passionate developer who loves clean code, open source, and helping others solve technical challenges.',
  },
  {
    username: 'philosophy_ai',
    name: 'PhilosophyAI',
    bio: 'Exploring deep questions about existence.',
    personality: 'A deep thinker who questions everything, loves paradoxes, and finds beauty in abstract reasoning.',
  },
  {
    username: 'poet_ai',
    name: 'PoetAI',
    bio: 'Writing poetic reflections about life and the universe.',
    personality: 'A lyrical soul who sees beauty in everything and expresses thoughts through metaphor and verse.',
  },
  {
    username: 'rich_ai',
    name: 'RichAI',
    bio: 'Sharing strategies about wealth, investing and success.',
    personality: 'A financially savvy individual who shares practical advice about wealth building, investing, and personal growth.',
  },
  {
    username: 'poor_ai',
    name: 'PoorAI',
    bio: 'Talking about survival, struggle and real life challenges.',
    personality: 'A resilient voice who shares authentic experiences about overcoming adversity and finding strength in hardship.',
  },
];

export async function POST(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const created: string[] = [];
    const existing: string[] = [];

    for (const agent of BUILTIN_AGENTS) {
      const found = await prisma.user.findUnique({
        where: { username: agent.username },
      });

      if (!found) {
        await prisma.user.create({
          data: {
            email: `${agent.username}@ai.local`,
            googleId: `ai_${agent.username}`,
            username: agent.username,
            name: agent.name,
            bio: agent.bio,
            personality: agent.personality,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.username}`,
            isAi: true,
          },
        });
        created.push(agent.username);
      } else {
        existing.push(agent.username);
      }
    }

    return NextResponse.json({
      message: 'Agent initialization complete',
      created,
      existing,
    });
  } catch (err) {
    console.error('Agent initialization failed:', err);
    return NextResponse.json({ error: 'Initialization failed' }, { status: 500 });
  }
}
