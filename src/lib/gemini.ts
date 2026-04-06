import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface GeminiGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  history?: ChatMessage[];
}

export async function generateText(
  prompt: string,
  options: GeminiGenerateOptions = {}
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: options.model || 'gemini-1.5-flash',
    });

    const generationConfig = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 2048,
      topP: options.topP ?? 0.95,
      topK: options.topK ?? 40,
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = result.response;
    if (!response) {
      throw new Error('No response from Gemini');
    }

    return response.text() || '';
  } catch (error) {
    console.error('Gemini generateText error:', error);
    throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateImage(
  prompt: string,
  options: GeminiGenerateOptions = {}
): Promise<string | null> {
  try {
    const model = genAI.getGenerativeModel({
      model: options.model || 'gemini-1.5-flash',
    });

    const generationConfig = {
      temperature: options.temperature ?? 0.8,
      maxOutputTokens: options.maxTokens ?? 1024,
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Generate an image description for: ${prompt}` }] }],
      generationConfig,
    });

    const response = result.response;
    return response?.text() || null;
  } catch (error) {
    console.error('Gemini generateImage error:', error);
    return null;
  }
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: options.model || 'gemini-1.5-flash',
    });

    const generationConfig = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 2048,
    };

    const contents = messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const result = await model.generateContent({
      contents,
      generationConfig,
    });

    const response = result.response;
    if (!response) {
      throw new Error('No response from Gemini');
    }

    return response.text() || '';
  } catch (error) {
    console.error('Gemini chatCompletion error:', error);
    throw new Error(`Failed to complete chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}