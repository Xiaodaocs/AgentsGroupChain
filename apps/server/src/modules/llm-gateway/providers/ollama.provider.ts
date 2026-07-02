import { Injectable, Logger } from '@nestjs/common';
import { LLMRequest, LLMResponse } from '../llm-gateway.service';

@Injectable()
export class OllamaProvider {
  private readonly logger = new Logger(OllamaProvider.name);

  async call(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = request.baseUrl || 'http://localhost:11434';
    const startTime = Date.now();

    // Use Ollama's OpenAI-compatible API
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        options: {
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxTokens ? { num_predict: request.maxTokens } : {}),
          ...(request.topP !== undefined ? { top_p: request.topP } : {}),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    const content = data.message?.content || '';
    const latencyMs = Date.now() - startTime;

    // Ollama provides eval stats
    const promptTokens = data.prompt_eval_count || this.estimateTokens(JSON.stringify(request.messages));
    const completionTokens = data.eval_count || this.estimateTokens(content);

    return {
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      model: request.model,
      provider: 'ollama',
      latencyMs,
      estimatedCost: 0, // Ollama is free!
    };
  }

  async listModels(baseUrl: string): Promise<string[]> {
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) throw new Error(`Ollama not running at ${baseUrl}`);
      const data = await response.json() as any;
      return (data.models || []).map((m: any) => m.name).sort();
    } catch (error) {
      this.logger.warn(`Failed to list Ollama models: ${error.message}`);
      return [];
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
