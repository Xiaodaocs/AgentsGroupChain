import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CostRecordEntity } from '../../entities/cost-record.entity';
import { CostsController } from './costs.controller';
import { LLMGatewayModule } from '../llm-gateway/llm-gateway.module';
import { CostTrackerService } from '../llm-gateway/cost-tracker.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CostRecordEntity]),
    LLMGatewayModule,
  ],
  controllers: [CostsController],
  providers: [CostTrackerService],
})
export class CostsModule {}
