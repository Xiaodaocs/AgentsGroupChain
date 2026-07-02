import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { LLMRequest, LLMResponse } from '../llm-gateway.service';

@Injectable()
export class AnthropicProvider {
  private readonly logger = new Logger(AnthropicProvider.name);

  private readonly pricing: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
    'claude-haiku-4-20250414': { input: 0.80, output: 4.00 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
    // DashScope Coding Plan - free
    'qwen3.7-plus': { input: 0, output: 0 },
    'qwen3.5-plus': { input: 0, output: 0 },
    'qwen3-coder-plus': { input: 0, output: 0 },
  };

  async call(request: LLMRequest): Promise<LLMResponse> {
    const clientOptions: any = {
      apiKey: request.apiKey || 'no-key',
    };

    // Support custom base URL (e.g. DashScope Coding Plan)
    if (request.baseUrl) {
      clientOptions.baseURL = request.baseUrl;
    }

    const client = new Anthropic(clientOptions);

    // Extract system message
    const systemMsg = request.messages.find(m => m.role === 'system');
    const nonSystemMsgs = request.messages.filter(m => m.role !== 'system');

    // Ensure we have at least one user message (Anthropic requires alternating user/assistant)
    const messages = nonSystemMsgs.length > 0
      ? nonSystemMsgs.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      : [{ role: 'user' as const, content: request.messages[0]?.content || 'hello' }];

    const params: any = {
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      messages,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    };

    const response = await client.messages.create(params);

    const content = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    const promptTokens = response.usage.input_tokens;
    const completionTokens = response.usage.output_tokens;
    const pricing = this.pricing[request.model] || { input: 0, output: 0 };
    const estimatedCost = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;

    return {
      content,
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
}
