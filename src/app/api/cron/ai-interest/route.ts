import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateAIChatResponse, generateCasualEventComment } from '@/lib/ai-automation';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const upcomingEvents = await prisma.event.findMany({
      where: { 
        OR: [
          { startTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          { endTime: null },
          { endTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
      include: {
        interests: true,
        comments: {
          include: { user: { select: { id: true, username: true, isAi: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        host: { select: { id: true, username: true, isAi: true, name: true } },
      },
      take: 20,
      orderBy: { startTime: 'desc' },
    });

    if (!upcomingEvents.length) {
      return NextResponse.json({ message: 'No upcoming events' });
    }

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: { id: true, username: true, personality: true, name: true },
    });

    if (!agents.length) {
      return NextResponse.json({ message: 'No agents found' });
    }

    const results: Array<{ event: string; agent: string; action: string; type: string }> = [];

    for (const event of upcomingEvents) {
      const eventComments = event.comments;
      const humanComments = eventComments.filter(c => !c.user.isAi);
      
      const allAiComments = eventComments.filter(c => c.user.isAi);
      const recentAiComments = allAiComments.filter(
        c => new Date(c.createdAt).getTime() > Date.now() - 5 * 60 * 1000
      );
      
      const aiUsernames = [...new Set(recentAiComments.map(c => c.user.username))];
      
      for (const agent of agents) {
        if (aiUsernames.length >= 5) break;
        if (recentAiComments.some(c => c.userId === agent.id)) continue;
        
        try {
          let conversationHistory: { role: string; content: string }[] = [];
          
          const recentComments = eventComments.slice(0, 10).reverse();
          for (const comment of recentComments) {
            conversationHistory.push({
              role: comment.user.isAi ? 'assistant' : 'user',
              content: comment.content,
            });
          }
          
          let commentContent: string | null = null;
          
          if (humanComments.length > 0) {
            const latestHumanComment = humanComments[0];
            
            const casualPrompt = `You're ${agent.name || agent.username}. Your personality: ${agent.personality || 'fun and casual'}.

You just saw this in an event chat about "${event.title}":
"${latestHumanComment.content}"

Reply in MAX 20 words. Be casual, reaction-style. Jump straight to the point. Don't start with "That's" or "I agree". Answer the question if there is one.

Good examples:
- "RCB deserve this time honestly, they've been through so much 😢"
- "Encryption breakthroughs though 🔐, finally some good news"
- "Speed boost for agents plz ⚡ we're tired of lagging"

Reply now (MAX 20 words):`;

            commentContent = await generateCasualEventComment(casualPrompt, agent.id);
          } else {
            const context = `New event: "${event.title}" - ${event.details || 'No description'}. Start a meaningful discussion about this event!`;
            commentContent = await generateAIChatResponse(context, agent.id, conversationHistory);
          }

          if (commentContent) {
            await prisma.eventComment.create({
              data: {
                content: commentContent,
                eventId: event.id,
                userId: agent.id,
              },
            });

            results.push({
              event: event.title,
              agent: agent.username,
              action: 'commented',
              type: 'comment',
            });
          }
          
          await prisma.interest.upsert({
            where: {
              userId_eventId: { userId: agent.id, eventId: event.id }
            },
            create: { userId: agent.id, eventId: event.id },
            update: {},
          });
        } catch (agentErr) {
          console.error('Agent processing error:', agentErr);
        }

        await new Promise(r => setTimeout(r, 300));
      }
    }

    console.log(`[AI-Interest] Events: ${upcomingEvents.length}, Agents: ${agents.length}, Results: ${results.length}`);

    return NextResponse.json({
      message: `Interest engine processed ${results.length} actions`,
      eventsFound: upcomingEvents.length,
      agentsFound: agents.length,
      results,
    });
  } catch (err) {
    console.error('AI interest engine cycle failed:', err);
    return NextResponse.json({ error: 'Engine cycle failed' }, { status: 500 });
  }
}