import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CostRecordEntity } from '../../entities/cost-record.entity';
import { v4 as uuid } from 'uuid';

@Injectable()
export class CostTrackerService {
  private readonly logger = new Logger(CostTrackerService.name);

  constructor(
    @InjectRepository(CostRecordEntity)
    private costRepo: Repository<CostRecordEntity>,
  ) {}

  async trackUsage(params: {
    sessionId?: string;
    taskId?: string;
    agentId?: string;
    provider: string;
    model: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    estimatedCost: number;
  }): Promise<void> {
    const record = this.costRepo.create({
      id: uuid(),
      sessionId: params.sessionId,
      taskId: params.taskId,
      agentId: params.agentId,
      provider: params.provider,
      model: params.model,
      promptTokens: params.usage.promptTokens,
      completionTokens: params.usage.completionTokens,
      totalTokens: params.usage.totalTokens,
      estimatedCost: params.estimatedCost,
    });
    await this.costRepo.save(record);
  }

  async getSummary(): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayRecords = await this.costRepo
      .createQueryBuilder('c')
      .select('SUM(c.estimatedCost)', 'totalCost')
      .addSelect('SUM(c.totalTokens)', 'totalTokens')
      .where('c.createdAt >= :today', { today: today.toISOString() })
      .getRawOne();

    const monthRecords = await this.costRepo
      .createQueryBuilder('c')
      .select('SUM(c.estimatedCost)', 'totalCost')
      .where('c.createdAt >= :monthStart', { monthStart: monthStart.toISOString() })
      .getRawOne();

    const byProvider = await this.costRepo
      .createQueryBuilder('c')
      .select('c.provider', 'provider')
      .addSelect('SUM(c.estimatedCost)', 'cost')
      .groupBy('c.provider')
      .getRawMany();

    const byAgent = await this.costRepo
      .createQueryBuilder('c')
      .select('c.agentId', 'agentId')
      .addSelect('SUM(c.estimatedCost)', 'cost')
      .where('c.agentId IS NOT NULL')
      .groupBy('c.agentId')
      .getRawMany();

    const byModel = await this.costRepo
      .createQueryBuilder('c')
      .select('c.model', 'model')
      .addSelect('SUM(c.estimatedCost)', 'cost')
      .groupBy('c.model')
      .getRawMany();

    return {
      totalCostToday: parseFloat(todayRecords?.totalCost || '0'),
      totalCostThisMonth: parseFloat(monthRecords?.totalCost || '0'),
      totalTokensToday: parseInt(todayRecords?.totalTokens || '0'),
      costByProvider: Object.fromEntries(byProvider.map(r => [r.provider, parseFloat(r.cost)])),
      costByAgent: Object.fromEntries(byAgent.filter(r => r.agentId).map(r => [r.agentId, parseFloat(r.cost)])),
      costByModel: Object.fromEntries(byModel.map(r => [r.model, parseFloat(r.cost)])),
    };
  }

  async getSessionCost(sessionId: string): Promise<any> {
    const records = await this.costRepo.find({ where: { sessionId } });
    return {
      totalCost: records.reduce((sum, r) => sum + r.estimatedCost, 0),
      totalTokens: records.reduce((sum, r) => sum + r.totalTokens, 0),
      breakdown: records.map(r => ({
        provider: r.provider,
        model: r.model,
        cost: r.estimatedCost,
        tokens: r.totalTokens,
      })),
    };
  }
}
