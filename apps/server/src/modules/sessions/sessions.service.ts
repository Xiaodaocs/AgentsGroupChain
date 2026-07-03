import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionEntity } from '../../entities/session.entity';
import { MessageEntity } from '../../entities/message.entity';
import { v4 as uuid } from 'uuid';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectRepository(SessionEntity)
    private sessionRepo: Repository<SessionEntity>,
    @InjectRepository(MessageEntity)
    private messageRepo: Repository<MessageEntity>,
  ) {}

  async create(title: string, projectRoot?: string): Promise<SessionEntity> {
    const session = this.sessionRepo.create({
      id: uuid(),
      title,
      status: 'active',
      projectRoot: projectRoot || undefined,
    });
    return await this.sessionRepo.save(session) as SessionEntity;
  }

  async findAll(): Promise<SessionEntity[]> {
    return this.sessionRepo.find({ order: { updatedAt: 'DESC' } });
  }

  async findOne(id: string): Promise<SessionEntity> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  async remove(id: string): Promise<void> {
    await this.messageRepo.delete({ sessionId: id });
    await this.sessionRepo.delete(id);
  }

  async setProjectRoot(id: string, projectRoot: string): Promise<SessionEntity | null> {
    await this.sessionRepo.update(id, { projectRoot });
    return this.sessionRepo.findOne({ where: { id } });
  }

  async setReview(id: string, reviewEnabled: boolean): Promise<SessionEntity | null> {
    await this.sessionRepo.update(id, { reviewEnabled: reviewEnabled ? 1 : 0 });
    return this.sessionRepo.findOne({ where: { id } });
  }

  async rename(id: string, title: string): Promise<SessionEntity | null> {
    await this.sessionRepo.update(id, { title });
    return this.sessionRepo.findOne({ where: { id } });
  }

  async getMessages(sessionId: string): Promise<any[]> {
    const messages = await this.messageRepo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
    return messages.map(m => ({
      id: m.id,
      sessionId: m.sessionId,
      taskId: m.taskId,
      fromAgentId: m.fromAgentId,
      toAgentId: m.toAgentId,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
      toolResults: m.toolResults ? JSON.parse(m.toolResults) : undefined,
      metadata: JSON.parse(m.metadata || '{}'),
      createdAt: m.createdAt,
    }));
  }

  async addMessage(data: {
    sessionId: string;
    taskId?: string;
    fromAgentId?: string;
    toAgentId?: string;
    role: string;
    content: string;
    toolCalls?: any[];
    toolResults?: any[];
    metadata?: Record<string, any>;
  }): Promise<MessageEntity> {
    const message = this.messageRepo.create({
      id: uuid(),
      sessionId: data.sessionId,
      taskId: data.taskId,
      fromAgentId: data.fromAgentId,
      toAgentId: data.toAgentId,
      role: data.role,
      content: data.content,
      toolCalls: data.toolCalls ? JSON.stringify(data.toolCalls) : undefined,
      toolResults: data.toolResults ? JSON.stringify(data.toolResults) : undefined,
      metadata: JSON.stringify(data.metadata || {}),
    });
    const saved = await this.messageRepo.save(message);

    // Update session timestamp
    await this.sessionRepo.update(data.sessionId, { updatedAt: new Date() });

    return saved;
  }

  async updateCost(sessionId: string, cost: number, tokens: number): Promise<void> {
    await this.sessionRepo
      .createQueryBuilder()
      .update(SessionEntity)
      .set({
        totalCost: () => `totalCost + ${cost}`,
        totalTokens: () => `totalTokens + ${tokens}`,
      })
      .where('id = :id', { id: sessionId })
      .execute();
  }
}
