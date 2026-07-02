import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

// Entities
import { SessionEntity } from './entities/session.entity';
import { AgentEntity } from './entities/agent.entity';
import { TaskEntity } from './entities/task.entity';
import { MessageEntity } from './entities/message.entity';
import { ModelProviderEntity } from './entities/model-provider.entity';
import { CostRecordEntity } from './entities/cost-record.entity';
import { AgentTemplateEntity } from './entities/agent-template.entity';

// Modules
import { SessionsModule } from './modules/sessions/sessions.module';
import { AgentsModule } from './modules/agents/agents.module';
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module';
import { LLMGatewayModule } from './modules/llm-gateway/llm-gateway.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { ModelProviderModule } from './modules/model-provider/model-provider.module';
import { CostsModule } from './modules/costs/costs.module';
import { HealthModule } from './modules/health/health.module';
import { WebSocketModule } from './modules/websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqljs',
      autoSave: true,
      location: join(__dirname, '..', 'data', 'multiagent.db'),
      entities: [
        SessionEntity,
        AgentEntity,
        TaskEntity,
        MessageEntity,
        ModelProviderEntity,
        CostRecordEntity,
        AgentTemplateEntity,
      ],
      synchronize: true,
    }),
    SessionsModule,
    AgentsModule,
    OrchestratorModule,
    LLMGatewayModule,
    TemplatesModule,
    ModelProviderModule,
    CostsModule,
    HealthModule,
    WebSocketModule,
  ],
})
export class AppModule {}
