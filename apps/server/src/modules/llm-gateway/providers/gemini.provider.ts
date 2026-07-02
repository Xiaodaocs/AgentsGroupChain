import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMRequest, LLMResponse } from '../llm-gateway.service';

@Injectable()
export class GeminiProvider {
  private readonly logger = new Logger(GeminiProvider.name);

  private readonly pricing: Record<string, { input: number; output: number }> = {
    'gemini-2.5-flash': { input: 0.15, output: 0.60 },
    'gemini-2.5-pro': { input: 1.25, output: 10.00 },
    'gemini-2.0-flash': { input: 0.075, output: 0.30 },
    'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  };

  async call(request: LLMRequest): Promise<LLMResponse> {
    const genAI = new GoogleGenerativeAI(request.apiKey || 'no-key');
    const model = genAI.getGenerativeModel({
      model: request.model,
      ...(request.temperature !== undefined ? { generationConfig: { temperature: request.temperature } } : {}),
    });

    // Convert messages to Gemini format
    const history = request.messages
      .filter(m => m.role !== 'system')
      .slice(0, -1)
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = request.messages.find(m => m.role === 'system')?.content;

    const chat = model.startChat({
      history,
      ...(systemInstruction ? { systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] } } : {}),
    });

    const lastMessage = request.messages.filter(m => m.role !== 'system').slice(-1)[0];
    const result = await chat.sendMessage(lastMessage?.content || '');
    const response = await result.response;

    const text = response.text();
    // Gemini doesn't always provide usage info, estimate based on content
    const promptTokens = this.estimateTokens(JSON.stringify(history) + (systemInstruction || ''));
    const completionTokens = this.estimateTokens(text);
    const pricing = this.pricing[request.model] || { input: 0.15, output: 0.60 };
    const estimatedCost = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;

    return {
      content: text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      model: request.model,
      provider: 'gemini',
      latencyMs: 0,
      estimatedCost,
    };
  }

  async listModels(apiKey?: string): Promise<string[]> {
    // Gemini SDK may not support listModels in all versions
    // Return known model list
    return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
