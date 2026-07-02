import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelProviderEntity } from '../../entities/model-provider.entity';
import { LLMGatewayService } from '../llm-gateway/llm-gateway.service';
import { v4 as uuid } from 'uuid';

const DEFAULT_PROVIDERS = [
  {
    provider: 'ollama',
    displayName: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434',
    isEnabled: 1,
    rateLimitRPM: 999,
    rateLimitRPD: 999999,
    models: JSON.stringify([
      { id: 'llama3.2', name: 'Llama 3.2 8B', contextWindow: 128000, inputCostPer1M: 0, outputCostPer1M: 0, isFree: true, capabilities: ['chat'] },
      { id: 'qwen3:8b', name: 'Qwen 3 8B', contextWindow: 32000, inputCostPer1M: 0, outputCostPer1M: 0, isFree: true, capabilities: ['chat'] },
      { id: 'gemma3:4b', name: 'Gemma 3 4B', contextWindow: 8000, inputCostPer1M: 0, outputCostPer1M: 0, isFree: true, capabilities: ['chat'] },
    ]),
  },
  {
    provider: 'groq',
    displayName: 'Groq',
    isEnabled: 0,
    rateLimitRPM: 30,
    rateLimitRPD: 14400,
    models: JSON.stringify([
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, inputCostPer1M: 0.05, outputCostPer1M: 0.08, isFree: true, capabilities: ['chat'] },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', contextWindow: 128000, inputCostPer1M: 0.05, outputCostPer1M: 0.08, isFree: true, capabilities: ['chat'] },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, inputCostPer1M: 0.24, outputCostPer1M: 0.24, isFree: true, capabilities: ['chat'] },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', contextWindow: 8192, inputCostPer1M: 0.20, outputCostPer1M: 0.20, isFree: true, capabilities: ['chat'] },
    ]),
  },
  {
    provider: 'gemini',
    displayName: 'Google Gemini',
    isEnabled: 0,
    rateLimitRPM: 15,
    rateLimitRPD: 1500,
    models: JSON.stringify([
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1000000, inputCostPer1M: 0.15, outputCostPer1M: 0.60, isFree: true, capabilities: ['chat', 'vision'] },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1000000, inputCostPer1M: 1.25, outputCostPer1M: 10.00, isFree: false, capabilities: ['chat', 'vision'] },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, inputCostPer1M: 0.075, outputCostPer1M: 0.30, isFree: true, capabilities: ['chat', 'vision'] },
    ]),
  },
  {
    provider: 'deepseek',
    displayName: 'DeepSeek',
    isEnabled: 0,
    rateLimitRPM: 60,
    rateLimitRPD: 50000,
    models: JSON.stringify([
      { id: 'deepseek-chat', name: 'DeepSeek V3', contextWindow: 64000, inputCostPer1M: 0.14, outputCostPer1M: 0.28, isFree: false, capabilities: ['chat'] },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', contextWindow: 64000, inputCostPer1M: 0.55, outputCostPer1M: 2.19, isFree: false, capabilities: ['chat', 'reasoning'] },
    ]),
  },
  {
    provider: 'openrouter',
    displayName: 'OpenRouter',
    isEnabled: 0,
    rateLimitRPM: 20,
    rateLimitRPD: 1000,
    models: JSON.stringify([
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', contextWindow: 128000, inputCostPer1M: 0, outputCostPer1M: 0, isFree: true, capabilities: ['chat'] },
      { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3 (Free)', contextWindow: 64000, inputCostPer1M: 0, outputCostPer1M: 0, isFree: true, capabilities: ['chat'] },
      { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen 3 235B (Free)', contextWindow: 40000, inputCostPer1M: 0, outputCostPer1M: 0, isFree: true, capabilities: ['chat'] },
    ]),
  },
  {
    provider: 'mistral',
    displayName: 'Mistral AI',
    isEnabled: 0,
    rateLimitRPM: 30,
    rateLimitRPD: 5000,
    models: JSON.stringify([
      { id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 32000, inputCostPer1M: 0.10, outputCostPer1M: 0.30, isFree: false, capabilities: ['chat'] },
      { id: 'codestral-latest', name: 'Codestral', contextWindow: 32000, inputCostPer1M: 0.30, outputCostPer1M: 0.90, isFree: false, capabilities: ['chat', 'coding'] },
    ]),
  },
  {
    provider: 'openai',
    displayName: 'OpenAI',
    isEnabled: 0,
    rateLimitRPM: 60,
    rateLimitRPD: 10000,
    models: JSON.stringify([
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, inputCostPer1M: 0.15, outputCostPer1M: 0.60, isFree: false, capabilities: ['chat', 'vision', 'function-calling'] },
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, inputCostPer1M: 2.50, outputCostPer1M: 10.00, isFree: false, capabilities: ['chat', 'vision', 'function-calling'] },
    ]),
  },
  {
    provider: 'anthropic',
    displayName: 'Anthropic',
    isEnabled: 0,
    rateLimitRPM: 60,
    rateLimitRPD: 10000,
    models: JSON.stringify([
      { id: 'claude-haiku-4-20250414', name: 'Claude Haiku 4', contextWindow: 200000, inputCostPer1M: 0.80, outputCostPer1M: 4.00, isFree: false, capabilities: ['chat', 'vision'] },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, inputCostPer1M: 3.00, outputCostPer1M: 15.00, isFree: false, capabilities: ['chat', 'vision'] },
    ]),
  },
];

@Injectable()
export class ModelProviderService implements OnModuleInit {
  private readonly logger = new Logger(ModelProviderService.name);

  constructor(
    @InjectRepository(ModelProviderEntity)
    private providerRepo: Repository<ModelProviderEntity>,
    private llmGateway: LLMGatewayService,
  ) {}

  async onModuleInit() {
    const count = await this.providerRepo.count();
    if (count === 0) {
      this.logger.log('Seeding default model providers...');
      for (const p of DEFAULT_PROVIDERS) {
        const entity = this.providerRepo.create({ id: uuid(), ...p });
        await this.providerRepo.save(entity);
      }
    }
  }

  async create(data: any): Promise<ModelProviderEntity> {
    const entity = this.providerRepo.create({
      id: uuid(),
      provider: data.provider,
      displayName: data.displayName,
      apiKey: data.apiKey,
      baseUrl: data.baseUrl,
      isEnabled: data.isEnabled ?? 1,
      rateLimitRPM: data.rateLimitRPM ?? 60,
      rateLimitRPD: data.rateLimitRPD ?? 10000,
      defaultModel: data.defaultModel,
      models: JSON.stringify(data.models || []),
    });
    return this.providerRepo.save(entity);
  }

  async findAll(): Promise<any[]> {
    const providers = await this.providerRepo.find();
    return providers.map(p => ({
      ...p,
      models: JSON.parse(p.models || '[]'),
      apiKey: p.apiKey ? `${p.apiKey.substring(0, 8)}****` : null,
    }));
  }

  async findOne(id: string): Promise<any> {
    const p = await this.providerRepo.findOne({ where: { id } });
    if (!p) throw new Error(`Provider ${id} not found`);
    return {
      ...p,
      models: JSON.parse(p.models || '[]'),
    };
  }

  async update(id: string, data: any): Promise<ModelProviderEntity> {
    const entity = await this.providerRepo.findOne({ where: { id } });
    if (!entity) throw new Error(`Provider ${id} not found`);

    if (data.apiKey !== undefined) entity.apiKey = data.apiKey;
    if (data.baseUrl !== undefined) entity.baseUrl = data.baseUrl;
    if (data.isEnabled !== undefined) entity.isEnabled = data.isEnabled;
    if (data.displayName !== undefined) entity.displayName = data.displayName;
    if (data.rateLimitRPM !== undefined) entity.rateLimitRPM = data.rateLimitRPM;
    if (data.rateLimitRPD !== undefined) entity.rateLimitRPD = data.rateLimitRPD;
    if (data.defaultModel !== undefined) entity.defaultModel = data.defaultModel;
    if (data.models !== undefined) entity.models = JSON.stringify(data.models);

    return this.providerRepo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.providerRepo.delete(id);
  }

  async testConnection(provider: string, apiKey?: string, baseUrl?: string): Promise<any> {
    return this.llmGateway.testConnection(provider, apiKey, baseUrl);
  }
}
