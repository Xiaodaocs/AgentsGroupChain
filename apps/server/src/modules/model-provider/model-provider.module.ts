import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelProviderEntity } from '../../entities/model-provider.entity';
import { ModelProviderController } from './model-provider.controller';
import { ModelProviderService } from './model-provider.service';
import { LLMGatewayModule } from '../llm-gateway/llm-gateway.module';

@Module({
  imports: [TypeOrmModule.forFeature([ModelProviderEntity]), LLMGatewayModule],
  controllers: [ModelProviderController],
  providers: [ModelProviderService],
  exports: [ModelProviderService],
})
export class ModelProviderModule {}
