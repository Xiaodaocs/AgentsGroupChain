import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { LLMRequest, LLMResponse } from '../llm-gateway.service';

@Injectable()
export class OpenAIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);

  // Model pricing (USD per 1M tokens)
  private readonly pricing: Record<string, { input: number; output: number }> = {
    // OpenAI
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4o-2024-08-06': { input: 2.50, output: 10.00 },
    'o4-mini': { input: 1.10, output: 4.40 },
    // Groq (all free tier models - cost = 0)
    'llama-3.3-70b-versatile': { input: 0.05, output: 0.08 },
    'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
    'llama4-scout-17b-16e-instruct': { input: 0.11, output: 0.34 },
    'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
    'gemma2-9b-it': { input: 0.20, output: 0.20 },
    // DeepSeek
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'deepseek-coder': { input: 0.14, output: 0.28 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
    // OpenRouter free models
    'meta-llama/llama-3.3-70b-instruct:free': { input: 0, output: 0 },
    'google/gemini-2.5-flash-preview': { input: 0, output: 0 },
    'deepseek/deepseek-chat-v3-0324:free': { input: 0, output: 0 },
    'qwen/qwen3-235b-a22b:free': { input: 0, output: 0 },
    // Mistral
    'mistral-small-latest': { input: 0.10, output: 0.30 },
    'codestral-latest': { input: 0.30, output: 0.90 },
    'mistral-large-latest': { input: 2.00, output: 6.00 },
  };

  async call(request: LLMRequest): Promise<LLMResponse> {
    const client = new OpenAI({
      apiKey: request.apiKey || 'no-key',
      baseURL: this.getBaseUrl(request),
    });

    const params: any = {
      model: request.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      ...(request.topP !== undefined ? { top_p: request.topP } : {}),
      ...(request.tools ? { tools: request.tools } : {}),
    };

    const response = await client.chat.completions.create(params);
    const choice = response.choices[0];
    const message = choice.message;

    const promptTokens = response.usage?.prompt_tokens ?? 0;
    const completionTokens = response.usage?.completion_tokens ?? 0;
    const pricing = this.pricing[request.model] || { input: 0.50, output: 1.50 };
    const estimatedCost = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;

    return {
      content: message.content || '',
      toolCalls: message.tool_calls as any[],
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      model: response.model,
      provider: request.provider,
      latencyMs: 0,
      estimatedCost,
    };
  }

  async listModels(apiKey?: string, baseUrl?: string): Promise<string[]> {
    try {
      const client = new OpenAI({
        apiKey: apiKey || 'no-key',
        baseURL: baseUrl || this.getDefaultBaseUrl('openai'),
      });
      const response = await client.models.list();
      return response.data.map(m => m.id).sort();
    } catch (error) {
      this.logger.warn(`Failed to list models: ${error.message}`);
      return [];
    }
  }

  private getBaseUrl(request: LLMRequest): string {
    if (request.baseUrl) return request.baseUrl;
    return this.getDefaultBaseUrl(request.provider);
  }

  private getDefaultBaseUrl(provider: string): string {
    const urls: Record<string, string> = {
      'openai': 'https://api.openai.com/v1',
      'groq': 'https://api.groq.com/openai/v1',
      'deepseek': 'https://api.deepseek.com/v1',
      'openrouter': 'https://openrouter.ai/api/v1',
      'mistral': 'https://api.mistral.ai/v1',
      'dashscope-coding': 'https://coding.dashscope.aliyuncs.com/v1',
      'custom': 'http://localhost:8080/v1',
    };
    return urls[provider] || urls['openai'];
  }
}
