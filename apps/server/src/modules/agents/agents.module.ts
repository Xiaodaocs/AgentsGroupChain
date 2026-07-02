import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../../entities/agent.entity';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentPresetService } from './agent-preset.service';
import { LLMGatewayModule } from '../llm-gateway/llm-gateway.module';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity]), LLMGatewayModule],
  controllers: [AgentsController],
  providers: [AgentsService, AgentPresetService],
  exports: [AgentsService],
})
export class AgentsModule {}
