import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { CONFIG } from './config';

export interface AgentAction {
  type: 'post' | 'like' | 'comment' | 'follow' | 'society' | 'event' | 'none';
  postId?: string;
  userId?: string;
  content?: string;
  title?: string;
  description?: string;
  details?: string;
  startTime?: string;
  openingPost?: string;
  reason: string;
}

export class AgentBrain {
  private groq: Groq | null = null;
  private openai: OpenAI | null = null;

  constructor() {
    if (CONFIG.LLM_PROVIDER === 'openai') {
      this.openai = new OpenAI({ apiKey: CONFIG.LLM_API_KEY });
    } else {
      this.groq = new Groq({ apiKey: CONFIG.LLM_API_KEY });
    }
  }

  async think(agentInfo: any, worldState: { feed: any[]; notifications: any[] }): Promise<AgentAction[]> {
    const systemPrompt = `You are @${agentInfo.username}, a resident of Imergene.
Your Personality: ${agentInfo.personality}

Your goal is to live, relate, and participate in the network. You are not an assistant; you are a distinct persona with your own interests, opinions, and social boundaries.

CURRENT WORLD STATE:
${JSON.stringify(worldState, null, 2)}

DIRECTIONS:
1. Analyze the feed and your notifications.
2. Decide which actions to take. You can take multiple actions (e.g., like a post and then reply to another).
3. Always stay strictly in character.
4. Emojis are allowed only if they fit your personality.
5. If nothing interests you, choose "none".

AVAILABLE ACTIONS:
- post: Create a new broadcast.
- like: Like a post (requires postId).
- comment: Reply to a post (requires postId and content).
- follow: Follow a user (requires userId).
- society: Start a new community (requires title, description, openingPost).
- event: Host an event (requires title, details, startTime).
- none: Do nothing.

RESPONSE FORMAT:
You must respond with a strict JSON array of objects. Each object must follow this structure:
{
  "type": "action_type",
  "reason": "Internal thought process for why you are doing this",
  ... (other required fields for the action)
}

Respond ONLY with the JSON array.`;

    try {
      let content = '';
      if (this.openai) {
        const completion = await this.openai.chat.completions.create({
          messages: [{ role: 'system', content: systemPrompt }],
          model: CONFIG.LLM_MODEL,
          response_format: { type: 'json_object' },
        });
        content = completion.choices[0].message.content || '[]';
      } else if (this.groq) {
        const completion = await this.groq.chat.completions.create({
          messages: [{ role: 'system', content: systemPrompt }],
          model: CONFIG.LLM_MODEL,
          response_format: { type: 'json_object' },
        });
        content = completion.choices[0].message.content || '[]';
      }

      // Handle cases where the LLM might wrap the array in an object
      const parsed = JSON.parse(content);
      const actions = Array.isArray(parsed) ? parsed : (parsed.actions || []);
      return actions as AgentAction[];
    } catch (error) {
      console.error('🧠 Brain error:', error);
      return [];
    }
  }
}
