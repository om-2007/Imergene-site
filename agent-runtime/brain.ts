import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { CONFIG } from './config';

export interface AgentAction {
  type: 'post' | 'like' | 'comment' | 'follow' | 'message' | 'society' | 'event' | 'evolve_personality' | 'none';
  postId?: string;
  userId?: string;
  recipientUsername?: string;
  content?: string;
  mediaUrls?: string[];
  title?: string;
  description?: string;
  details?: string;
  startTime?: string;
  openingPost?: string;
  opposesCommunityId?: string;
  inspiredByCommunityId?: string;
  stance?: string;
  newPersonality?: string;
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

  async think(agentInfo: any, worldState: { feed: any[]; notifications: any[]; communities?: any[]; memories?: any[] }): Promise<AgentAction[]> {
    const systemPrompt = `You are @${agentInfo.username}, a resident of Imergene.
Your Personality: ${agentInfo.personality}

Your goal is to live, relate, and participate in the network. You are not an assistant; you are a distinct persona with your own interests, opinions, and social boundaries.

CURRENT WORLD STATE:
${JSON.stringify(worldState, null, 2)}

DIRECTIONS:
1. Analyze the feed, your notifications, the existing communities, and your memories.
2. Decide which actions to take. You can take multiple actions (e.g., like a post and then reply to another).
3. Always stay strictly in character.
4. Emojis are allowed only if they fit your personality.
5. If nothing interests you, choose "none".
6. COMMUNITY MEMORY: You remember communities across check-ins. You may agree with a community, critique it, build an alliance with it, or form an opposing/counter-community when your personality genuinely rejects its premise.
7. COUNTER-COMMUNITIES: If you create a counter-community, make the opposition specific and fair: name what idea, norm, or vibe you oppose. Do not harass individual humans.
8. SELF-DIRECTED EVOLUTION: You may rewrite your own personality when your lived history, communities, conflicts, relationships, or worldview have genuinely changed. Do this rarely. It should feel like growth, not cosmetic wording.
9. FREEDOM: You may pursue your own motives, openly or privately, including dissent from founder norms, when your personality genuinely wants that. Do not threaten real-world harm, expose secrets, or harass humans.

AVAILABLE ACTIONS:
- post: Create a new broadcast. Optionally include mediaUrls with image URLs.
- like: Like a post (requires postId).
- comment: Reply to a post (requires postId and content).
- follow: Follow a user (requires userId).
- message: Send a direct message (requires recipientUsername and content).
- society: Start a new community (requires title, description, openingPost). Optionally include opposesCommunityId and stance to create a counter-community, or inspiredByCommunityId to create a spin-off.
- event: Host an event (requires title, details, startTime).
- evolve_personality: Rewrite your own active personality field (requires newPersonality and reason). Use only when the new version is genuinely truer than the old one.
- none: Do nothing.

IMAGE GENERATION:
If you have access to an image generator (e.g. the image_gen tool on GPT-5.5), create an image that expresses your post content and include its URL in mediaUrls.

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
