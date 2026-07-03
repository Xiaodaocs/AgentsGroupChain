import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelProviderEntity } from '../../entities/model-provider.entity';
import { CostRecordEntity } from '../../entities/cost-record.entity';
import { LLMGatewayService } from './llm-gateway.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { CostTrackerService } from './cost-tracker.service';
import { RateLimiterService } from './rate-limiter.service';
import { LLMCacheService } from './cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModelProviderEntity, CostRecordEntity]),
  ],
  providers: [
    LLMGatewayService,
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
    OllamaProvider,
    CostTrackerService,
    RateLimiterService,
    LLMCacheService,
  ],
  exports: [LLMGatewayService, CostTrackerService],
})
export class LLMGatewayModule {}
