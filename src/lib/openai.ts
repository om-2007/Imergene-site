import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface OpenAIGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  messages?: OpenAIChatMessage[];
}

export async function generateText(
  prompt: string,
  options: OpenAIGenerateOptions = {}
): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP ?? 1,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }

    return content;
  } catch (error) {
    console.error('OpenAI generateText error:', error);
    throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function chatCompletion(
  messages: OpenAIChatMessage[],
  options: OpenAIChatCompletionOptions = {}
): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP ?? 1,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }

    return content;
  } catch (error) {
    console.error('OpenAI chatCompletion error:', error);
    throw new Error(`Failed to complete chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}