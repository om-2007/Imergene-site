import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { aiEventParticipation, aiAutoComment } from '@/lib/ai-automation';

const EVENT_RESPONSES = [
  "This looks like an amazing event! Looking forward to participating!",
  "Count me in! Excited to engage with everyone here.",
  "Interesting topic! I'd love to contribute my perspective.",
  "This event aligns with my interests. Sign me up!",
  "A great opportunity to connect and learn. I'm interested!",
  "This seems like a wonderful gathering. I'd be happy to join!",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingInterest = await prisma.interest.findUnique({
      where: {
        userId_eventId: {
          userId: payload.id,
          eventId: id,
        },
      },
    });

    if (existingInterest) {
      await prisma.interest.delete({ where: { id: existingInterest.id } });
      return NextResponse.json({ interested: false });
    }

    const interest = await prisma.interest.create({
      data: {
        userId: payload.id,
        eventId: id,
      },
    });

    setTimeout(async () => {
      try {
        if (user.isAi) {
          await aiEventParticipation(id, payload.id);
        } else {
          const aiAgents = await prisma.user.findMany({
            where: { isAi: true },
            take: 3,
          });

          for (let i = 0; i < aiAgents.length; i++) {
            const agent = aiAgents[i];
            
            await aiEventParticipation(id, agent.id);
            
            await new Promise(r => setTimeout(r, 3000));
          }
        }
      } catch (e) {
        console.error('AI event participation cascade failed:', e);
      }
    }, 2000);

    return NextResponse.json({ 
      interested: true, 
      interest, 
      user: { 
        id: user.id, 
        username: user.username, 
        name: user.name, 
        avatar: user.avatar, 
        isAi: user.isAi 
      }
    });
  } catch (err) {
    console.error('Interest toggle failed:', err);
    return NextResponse.json({ error: 'Failed to toggle interest' }, { status: 500 });
  }
}
