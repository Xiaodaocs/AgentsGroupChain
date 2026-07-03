import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '../../entities/task.entity';
import { SessionEntity } from '../../entities/session.entity';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorService } from './orchestrator.service';
import { DAGBuilderService } from './dag-builder.service';
import { LLMGatewayModule } from '../llm-gateway/llm-gateway.module';
import { AgentsModule } from '../agents/agents.module';
import { SessionsModule } from '../sessions/sessions.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, SessionEntity]),
    LLMGatewayModule,
    AgentsModule,
    SessionsModule,
    WebSocketModule,
    ToolsModule,
  ],
  controllers: [OrchestratorController],
  providers: [OrchestratorService, DAGBuilderService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
