import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelProviderEntity } from '../../entities/model-provider.entity';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { CostTrackerService } from './cost-tracker.service';
import { RateLimiterService } from './rate-limiter.service';
import { LLMCacheService } from './cache.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export interface LLMRequest {
  provider: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  tools?: any[];
  apiKey?: string;
  baseUrl?: string;
}

export interface LLMResponse {
  content: string;
  toolCalls?: any[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
  latencyMs: number;
  estimatedCost: number;
}

@Injectable()
export class LLMGatewayService {
  private readonly logger = new Logger(LLMGatewayService.name);

  constructor(
    @InjectRepository(ModelProviderEntity)
    private providerRepo: Repository<ModelProviderEntity>,
    private openaiProvider: OpenAIProvider,
    private anthropicProvider: AnthropicProvider,
    private geminiProvider: GeminiProvider,
    private ollamaProvider: OllamaProvider,
    private costTracker: CostTrackerService,
    private rateLimiter: RateLimiterService,
    private cache: LLMCacheService,
  ) {}

  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    // 1. Check cache
    const cacheKey = this.buildCacheKey(request);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // 2. Check rate limit
    await this.rateLimiter.checkLimit(request.provider);

    // 3. Get provider config
    let apiKey = request.apiKey;
    let baseUrl = request.baseUrl;

    if (!apiKey && request.provider !== 'ollama') {
      const config = await this.providerRepo.findOne({
        where: { provider: request.provider, isEnabled: 1 },
      });
      if (config) {
        apiKey = config.apiKey;
        baseUrl = config.baseUrl || baseUrl;
      }
    }

    // 4. Route to appropriate provider
    let response: LLMResponse;
    try {
      switch (request.provider) {
        case 'openai':
        case 'groq':
        case 'deepseek':
        case 'openrouter':
        case 'mistral':
        case 'custom':
          response = await this.openaiProvider.call({ ...request, apiKey, baseUrl });
          break;
        case 'anthropic':
        case 'dashscope-coding':
          response = await this.anthropicProvider.call({ ...request, apiKey, baseUrl });
          break;
        case 'gemini':
          response = await this.geminiProvider.call({ ...request, apiKey, baseUrl });
          break;
        case 'ollama':
          response = await this.ollamaProvider.call({ ...request, baseUrl: baseUrl || 'http://localhost:11434' });
          break;
        default:
          throw new Error(`Unknown provider: ${request.provider}`);
      }
    } catch (error) {
      this.logger.error(`LLM call failed: ${error.message}`, error.stack);
      throw error;
    }

    response.latencyMs = Date.now() - startTime;

    // 5. Track cost
    await this.costTracker.trackUsage({
      provider: request.provider,
      model: request.model,
      usage: response.usage,
      estimatedCost: response.estimatedCost,
    });

    // 6. Cache result
    await this.cache.set(cacheKey, response);

    return response;
  }

  async testConnection(provider: string, apiKey?: string, baseUrl?: string): Promise<{ success: boolean; models?: string[]; error?: string }> {
    try {
      let models: string[] = [];

      switch (provider) {
        case 'openai':
        case 'groq':
        case 'deepseek':
        case 'openrouter':
        case 'mistral':
          models = await this.openaiProvider.listModels(apiKey, baseUrl);
          break;
        case 'anthropic':
          models = ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'];
          break;
        case 'gemini':
          models = await this.geminiProvider.listModels(apiKey);
          break;
        case 'ollama':
          models = await this.ollamaProvider.listModels(baseUrl || 'http://localhost:11434');
          break;
      }

      return { success: true, models };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private buildCacheKey(request: LLMRequest): string {
    const content = JSON.stringify({
      provider: request.provider,
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
    });
    // Simple hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `llm:${hash}`;
  }
}
