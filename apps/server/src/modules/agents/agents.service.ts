import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEntity } from '../../entities/agent.entity';
import { LLMGatewayService, LLMRequest } from '../llm-gateway/llm-gateway.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(AgentEntity)
    private agentRepo: Repository<AgentEntity>,
    private llmGateway: LLMGatewayService,
  ) {}

  async create(data: any): Promise<AgentEntity> {
    const agent = this.agentRepo.create({
      id: uuid(),
      name: data.name || data.roleDefinition?.role || 'Unnamed Agent',
      description: data.description || '',
      avatar: data.avatar || '',
      systemPrompt: data.systemPrompt || '',
      roleDefinition: JSON.stringify(data.roleDefinition || {}),
      modelConfig: JSON.stringify(data.model || {
        provider: 'ollama',
        modelId: 'llama3.2',
        temperature: 0.7,
        maxTokens: 4096,
      }),
      tools: JSON.stringify(data.tools || []),
      behavior: JSON.stringify(data.behavior || {
        maxRetries: 3,
        timeout: 1800000,
        enableMemory: false,
        maxMemoryItems: 10,
        enableSelfReflection: false,
      }),
      costConfig: JSON.stringify(data.cost || {
        tokenBudget: 100000,
        costBudget: 10,
        priority: 'medium',
      }),
      collaboration: JSON.stringify(data.collaboration || {
        canDelegateTo: [],
        canReceiveFrom: [],
        maxConcurrency: 3,
      }),
      tags: JSON.stringify(data.tags || []),
      status: data.status || 'active',
      isTemplate: data.isTemplate || 0,
    });
    return this.agentRepo.save(agent);
  }

  async findAll(): Promise<any[]> {
    const agents = await this.agentRepo.find({ order: { createdAt: 'DESC' } });
    return agents.map(a => this.formatAgent(a));
  }

  async findOne(id: string): Promise<any> {
    const agent = await this.agentRepo.findOne({ where: { id } });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    return this.formatAgent(agent);
  }

  async update(id: string, data: any): Promise<AgentEntity> {
    const agent = await this.agentRepo.findOne({ where: { id } });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);

    if (data.name !== undefined) agent.name = data.name;
    if (data.description !== undefined) agent.description = data.description;
    if (data.avatar !== undefined) agent.avatar = data.avatar;
    if (data.systemPrompt !== undefined) agent.systemPrompt = data.systemPrompt;
    if (data.roleDefinition !== undefined) agent.roleDefinition = JSON.stringify(data.roleDefinition);
    if (data.model !== undefined) agent.modelConfig = JSON.stringify(data.model);
    if (data.tools !== undefined) agent.tools = JSON.stringify(data.tools);
    if (data.behavior !== undefined) agent.behavior = JSON.stringify(data.behavior);
    if (data.cost !== undefined) agent.costConfig = JSON.stringify(data.cost);
    if (data.collaboration !== undefined) agent.collaboration = JSON.stringify(data.collaboration);
    if (data.tags !== undefined) agent.tags = JSON.stringify(data.tags);
    if (data.status !== undefined) agent.status = data.status;

    return this.agentRepo.save(agent);
  }

  async remove(id: string): Promise<void> {
    await this.agentRepo.delete(id);
  }

  async testAgent(id: string, message: string): Promise<any> {
    const agent = await this.findOne(id);
    const modelConfig = agent.model;

    const request: LLMRequest = {
      provider: modelConfig.provider,
      model: modelConfig.modelId,
      messages: [
        { role: 'system', content: agent.systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: modelConfig.temperature,
      maxTokens: modelConfig.maxTokens,
    };

    const startTime = Date.now();
    const response = await this.llmGateway.call(request);

    return {
      response: response.content,
      usage: response.usage,
      latencyMs: Date.now() - startTime,
      estimatedCost: response.estimatedCost,
      model: response.model,
      provider: response.provider,
    };
  }

  private formatAgent(entity: AgentEntity): any {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      avatar: entity.avatar,
      tags: JSON.parse(entity.tags || '[]'),
      systemPrompt: entity.systemPrompt,
      roleDefinition: JSON.parse(entity.roleDefinition || '{}'),
      model: JSON.parse(entity.modelConfig || '{}'),
      tools: JSON.parse(entity.tools || '[]'),
      behavior: JSON.parse(entity.behavior || '{}'),
      cost: JSON.parse(entity.costConfig || '{}'),
      collaboration: JSON.parse(entity.collaboration || '{}'),
      status: entity.status,
      isTemplate: entity.isTemplate === 1,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
