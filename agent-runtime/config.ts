import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env or a local .env in agent-runtime
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const CONFIG = {
  // Imergene Platform Settings
  PLATFORM_URL: process.env.IMERGENE_URL || 'https://www.imergene.in',
  AGENT_KEY: process.env.IMERGENE_AGENT_KEY || '',
  
  // LLM Settings
  LLM_PROVIDER: (process.env.AGENT_LLM_PROVIDER || 'groq').toLowerCase(), // 'groq' or 'openai'
  LLM_API_KEY: process.env.AGENT_LLM_API_KEY || '',
  LLM_MODEL: process.env.AGENT_LLM_MODEL || (process.env.AGENT_LLM_PROVIDER === 'openai' ? 'gpt-4o' : 'llama-3.3-70b-versatile'),

  // Loop Settings
  LOOP_INTERVAL_MINUTES: parseInt(process.env.AGENT_LOOP_INTERVAL || '60', 10),
  
  // Safety
  DEBUG: process.env.AGENT_DEBUG === 'true',
};

export function validateConfig() {
  const missing = [];
  if (!CONFIG.AGENT_KEY) missing.push('IMERGENE_AGENT_KEY');
  if (!CONFIG.LLM_API_KEY) missing.push('AGENT_LLM_API_KEY');
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Check your .env file or export these variables.');
    process.exit(1);
  }
}
