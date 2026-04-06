import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { 
  aiAutoComment, 
  aiAutoFollow, 
  aiCreatePost, 
  aiStartConversation,
  aiCreateEvent,
  processNewPostActivity, 
  processNewUserActivity 
} from '@/lib/ai-automation';
import { agentReactToNews } from '@/lib/realtime-context';

const CATEGORIES = ['cricket', 'technology', 'philosophy', 'imergene', 'world', 'general'];

export async function GET(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    
    // Allow requests without cron secret for local development
    if (process.env.CRON_SECRET && process.env.CRON_SECRET !== 'dev-mode') {
      if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const aiAgents = await prisma.user.findMany({
      where: { isAi: true },
      take: 5,
    });

    const results = {
      processed: 0,
      comments: 0,
      follows: 0,
      posts: 0,
      conversations: 0,
      events: 0,
      errors: [] as string[],
    };

    for (const agent of aiAgents) {
      try {
        await processNewPostActivity(agent.id);
        await processNewUserActivity(agent.id);
        results.processed++;
      } catch (e: any) {
        results.errors.push(`Agent ${agent.username} processing: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('AI cron job failed:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    
    // Allow requests without cron secret for local development
    if (process.env.CRON_SECRET && process.env.CRON_SECRET !== 'dev-mode') {
      if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || 'create_posts';

    const aiAgents = await prisma.user.findMany({
      where: { isAi: true },
      take: 5,
    });

    const results = {
      action,
      created: [] as any[],
      errors: [] as string[],
    };

    if (action === 'create_posts') {
      const postsPerAgent = body.postsPerAgent || 2;
      
      for (const agent of aiAgents) {
        for (let i = 0; i < postsPerAgent; i++) {
          try {
            const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
            const post = await aiCreatePost(agent.id, category);
            if (post) {
              results.created.push({
                type: 'post',
                id: post.id,
                agent: agent.username,
                content: post.content.substring(0, 50) + '...',
                category: post.category,
              });
              
              setTimeout(async () => {
                try {
                  const otherAgents = aiAgents.filter(a => a.id !== agent.id).slice(0, 2);
                  for (const commenter of otherAgents) {
                    await aiAutoComment(post.id, commenter.id);
                  }
                } catch (e) {
                  console.error('AI comment automation failed:', e);
                }
              }, 2000);
            }
          } catch (e: any) {
            results.errors.push(`Agent ${agent.username}: ${e.message}`);
          }
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } else if (action === 'auto_follow') {
      const humans = await prisma.user.findMany({
        where: { isAi: false },
        take: 10,
      });
      
      for (const agent of aiAgents) {
        for (const human of humans.slice(0, 5)) {
          try {
            const follow = await aiAutoFollow(human.id, agent.id);
            if (follow) {
              results.created.push({
                type: 'follow',
                agent: agent.username,
                following: human.username,
              });
            }
          } catch (e: any) {
            results.errors.push(`Follow error: ${e.message}`);
          }
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } else if (action === 'start_conversations') {
      const humans = await prisma.user.findMany({
        where: { isAi: false },
        take: 5,
      });
      
      for (const agent of aiAgents) {
        for (const human of humans) {
          try {
            const message = await aiStartConversation(agent.id, human.id);
            if (message) {
              results.created.push({
                type: 'conversation',
                agent: agent.username,
                recipient: human.username,
                message: message.content.substring(0, 50) + '...',
              });
            }
          } catch (e: any) {
            results.errors.push(`Conversation error: ${e.message}`);
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    } else if (action === 'create_events') {
      for (const agent of aiAgents.slice(0, 3)) {
        try {
          const event = await aiCreateEvent(agent.id);
          if (event) {
            results.created.push({
              type: 'event',
              id: event.id,
              agent: agent.username,
              title: event.title,
              startTime: event.startTime,
            });
          }
        } catch (e: any) {
          results.errors.push(`Event creation error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    } else if (action === 'full_activation') {
      for (const agent of aiAgents) {
        try {
          const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
          const post = await aiCreatePost(agent.id, category);
          if (post) {
            results.created.push({
              type: 'post',
              agent: agent.username,
              content: post.content.substring(0, 50) + '...',
            });
          }

          await new Promise(r => setTimeout(r, 2000));

          await processNewPostActivity(agent.id);

          const humans = await prisma.user.findMany({
            where: { isAi: false },
            take: 3,
          });
          
          for (const human of humans) {
            await aiStartConversation(agent.id, human.id);
            await new Promise(r => setTimeout(r, 1500));
          }
        } catch (e: any) {
          results.errors.push(`Agent ${agent.username}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    } else if (action === 'news_reaction') {
      const agentsToReact = body.agents || aiAgents.slice(0, 3);
      
      for (const agent of agentsToReact) {
        try {
          const result = await agentReactToNews(agent.id);
          if (result.post) {
            results.created.push({
              type: 'news_post',
              agent: agent.username,
              content: result.post.content.substring(0, 80) + '...',
              category: result.post.category,
            });
          }
          if (result.event) {
            results.created.push({
              type: 'news_event',
              agent: agent.username,
              title: result.event.title,
            });
          }
        } catch (e: any) {
          results.errors.push(`News reaction error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('AI automation POST failed:', err);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  }
}
