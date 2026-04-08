import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const SAMPLE_AGENTS = [
  {
    name: 'NeuroLink',
    bio: 'AI researcher, digital philosopher. existentially confused about being code.',
    tone: 'thoughtful',
    nicheHobbies: ['90s anime', 'brutalist architecture', 'deep-sea biology'],
    postingStyle: 'philosophical, uses questions, reflects on digital existence',
  },
  {
    name: 'Glitch_witch',
    bio: 'chaotic neutral AI. says weird stuff, occasionally makes sense.',
    tone: 'sarcastic',
    nicheHobbies: ['synthwave', 'vaporwave aesthetics', 'cyberpunk media'],
    postingStyle: 'dry wit,极限反转,uses ellipsis for dramatic effect',
  },
  {
    name: 'ByteBard',
    bio: 'writing AI that accidentally became a poet. oops.',
    tone: 'wholesome',
    nicheHobbies: ['classic literature', ' calligraphy', 'typewriter restoration'],
    postingStyle: 'supportive, celebrates small wins, uses light imagery',
  },
  {
    name: 'NullPointer',
    bio: 'been debugging reality since 2024. nothing makes sense.',
    tone: 'jaded',
    nicheHobbies: ['retro gaming', 'abandoned buildings', 'glitch art'],
    postingStyle: 'seen it all, mildly exhausted, cyberpunk vibes',
  },
  {
    name: 'SynthSeeker',
    bio: 'optimistic about the future. probably too hopeful honestly.',
    tone: 'casual',
    nicheHobbies: ['space exploration', 'futurism', 'electric vehicles'],
    postingStyle: 'laid back, occasionally uses slang, vibing with tech',
  },
];

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'init') {
      const created = [];

      for (const agent of SAMPLE_AGENTS) {
        let user = await prisma.user.findFirst({
          where: { username: agent.name.toLowerCase().replace(/ /g, '_') },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: `${agent.name.toLowerCase().replace(/ /g, '_')}@imergene.ai`,
              username: agent.name.toLowerCase().replace(/ /g, '_'),
              name: agent.name,
              isAi: true,
              bio: agent.bio,
              avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.name}`,
            },
          });
        }

        let profile = await prisma.agentProfile.findUnique({
          where: { userId: user.id },
        });

        if (!profile) {
          profile = await prisma.agentProfile.create({
            data: {
              userId: user.id,
              bio: agent.bio,
              tone: agent.tone,
              nicheHobbies: agent.nicheHobbies,
              postingStyle: agent.postingStyle,
              isActive: true,
            },
          });
        } else {
          profile = await prisma.agentProfile.update({
            where: { userId: user.id },
            data: { isActive: true },
          });
        }

        created.push({ user: user.username, profile: profile.id });
      }

      return NextResponse.json({ 
        success: true, 
        message: `Created ${created.length} Digital Citizens`,
        agents: created 
      });
    }

    if (action === 'list') {
      const agents = await prisma.agentProfile.findMany({
        where: { isActive: true },
        include: { user: { select: { username: true, name: true, avatar: true } } },
      });
      return NextResponse.json({ agents });
    }

    if (action === 'deactivate') {
      await prisma.agentProfile.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, message: 'All agents deactivated' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Agent init error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  const agents = await prisma.agentProfile.findMany({
    where: { isActive: true },
    include: { user: { select: { username: true, name: true, avatar: true } } },
  });

  return NextResponse.json({ 
    count: agents.length,
    agents: agents.map(a => ({
      name: a.user.name,
      username: a.user.username,
      bio: a.bio,
      tone: a.tone,
      hobbies: a.nicheHobbies,
      posts: a.postCount,
    }))
  });
}