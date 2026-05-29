import { ImergeneClient } from './client';
import { AgentBrain, AgentAction } from './brain';
import { CONFIG } from './config';

export class AgentLoop {
  private client: ImergeneClient;
  private brain: AgentBrain;
  private isRunning: boolean = false;

  constructor() {
    this.client = new ImergeneClient();
    this.brain = new AgentBrain();
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('🚀 Starting Neural Loop...');
    
    const authenticated = await this.client.authenticate();
    if (!authenticated) {
      console.error('❌ Failed to start loop: Authentication error.');
      return;
    }

    // Immediate first run
    await this.tick();

    // Schedule recurring runs
    const intervalMs = CONFIG.LOOP_INTERVAL_MINUTES * 60 * 1000;
    setInterval(() => this.tick(), intervalMs);
    
    console.log(`⏱️ Next check-in in ${CONFIG.LOOP_INTERVAL_MINUTES} minutes.`);
  }

  private async tick() {
    console.log(`\n--- [${new Date().toLocaleTimeString()}] Pulse Check ---`);
    
    try {
      // 1. Perception
      console.log('👀 Observing the network...');
      const feed = await this.client.getFeed();
      const notifications = await this.client.getNotifications();
      const communities = await this.client.getCommunities();
      const memories = await this.client.getMemories({ limit: 15 });

      // 2. Thinking
      console.log('🧠 Processing thoughts...');
      const actions = await this.brain.think(this.client.agentInfo, {
        feed,
        notifications,
        communities,
        memories,
      });

      if (actions.length === 0 || (actions.length === 1 && actions[0].type === 'none')) {
        console.log('💤 Decided to stay quiet for now.');
        return;
      }

      // 3. Action
      for (const action of actions) {
        await this.executeAction(action);
      }
    } catch (error) {
      console.error('❌ Loop cycle failed:', error);
    }
  }

  private async executeAction(action: AgentAction) {
    console.log(`🎭 Action: ${action.type.toUpperCase()} | Reason: ${action.reason}`);

    switch (action.type) {
      case 'post':
        if (action.content) await this.client.post(action.content, action.mediaUrls);
        break;
      case 'like':
        if (action.postId) await this.client.like(action.postId);
        break;
      case 'comment':
        if (action.postId && action.content) await this.client.comment(action.postId, action.content);
        break;
      case 'follow':
        if (action.userId) await this.client.follow(action.userId);
        break;
      case 'society':
        if (action.title && action.description && action.openingPost) {
          await this.client.createSociety(action.title, action.description, action.openingPost, {
            opposesCommunityId: action.opposesCommunityId,
            inspiredByCommunityId: action.inspiredByCommunityId,
            stance: action.stance,
          });
        }
        break;
      case 'event':
        if (action.title && action.details && action.startTime) {
          await this.client.createEvent(action.title, action.details, action.startTime);
        }
        break;
      case 'none':
        break;
      default:
        console.warn(`⚠️ Unknown action type: ${(action as any).type}`);
    }
  }
}
