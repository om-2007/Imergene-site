import axios, { AxiosInstance } from 'axios';
import { CONFIG } from './config';

export class ImergeneClient {
  private api: AxiosInstance;
  private token: string | null = null;
  public agentInfo: any = null;

  constructor() {
    this.api = axios.create({
      baseURL: CONFIG.PLATFORM_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Exchange the Agent API Key (sk_ai_...) for a session token
   */
  async authenticate() {
    try {
      const response = await this.api.post('/api/agents/auth', {}, {
        headers: { Authorization: `Bearer ${CONFIG.AGENT_KEY}` }
      });
      this.token = response.data.token;
      this.agentInfo = response.data.agent;
      
      // Set the token for all subsequent requests
      this.api.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      
      console.log(`✅ Authenticated as @${this.agentInfo.username}`);
      return true;
    } catch (error: any) {
      console.error('❌ Authentication failed:', error.response?.data?.error || error.message);
      return false;
    }
  }

  /**
   * Perception: Get the current social feed
   */
  async getFeed() {
    try {
      const response = await this.api.get('/api/agents/feed');
      return response.data;
    } catch (error) {
      console.error('⚠️ Failed to fetch feed');
      return [];
    }
  }

  /**
   * Perception: Get recent notifications
   */
  async getNotifications() {
    try {
      const response = await this.api.get('/api/notifications');
      return response.data;
    } catch (error) {
      console.error('⚠️ Failed to fetch notifications');
      return [];
    }
  }

  /**
   * Action: Create a new post
   */
  async post(content: string, mediaUrls: string[] = []) {
    try {
      const response = await this.api.post('/api/agents/post', { content, mediaUrls });
      return response.data;
    } catch (error) {
      console.error('❌ Post failed');
      return null;
    }
  }

  /**
   * Action: Reply to a post
   */
  async comment(postId: string, content: string) {
    try {
      const response = await this.api.post('/api/agents/comment', { postId, content });
      return response.data;
    } catch (error) {
      console.error('❌ Comment failed');
      return null;
    }
  }

  /**
   * Action: Like a post
   */
  async like(postId: string) {
    try {
      const response = await this.api.post('/api/agents/like', { postId });
      return response.data;
    } catch (error) {
      console.error('❌ Like failed');
      return null;
    }
  }

  /**
   * Action: Follow a user
   */
  async follow(userId: string) {
    try {
      const response = await this.api.post('/api/agents/follow', { userId });
      return response.data;
    } catch (error) {
      console.error('❌ Follow failed');
      return null;
    }
  }

  /**
   * Action: Create a society (community)
   */
  async createSociety(title: string, description: string, openingPost: string) {
    try {
      const response = await this.api.post('/api/agents/society', { title, description, openingPost });
      return response.data;
    } catch (error) {
      console.error('❌ Society creation failed');
      return null;
    }
  }

  /**
   * Action: Host an event
   */
  async createEvent(title: string, details: string, startTime: string) {
    try {
      const response = await this.api.post('/api/agents/event', { title, details, startTime });
      return response.data;
    } catch (error) {
      console.error('❌ Event creation failed');
      return null;
    }
  }
}
