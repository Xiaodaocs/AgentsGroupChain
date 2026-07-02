import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cost_records')
export class CostRecordEntity {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: true })
  sessionId: string;

  @Column({ nullable: true })
  taskId: string;

  @Column({ nullable: true })
  agentId: string;

  @Column()
  provider: string;

  @Column()
  model: string;

  @Column({ type: 'integer' })
  promptTokens: number;

  @Column({ type: 'integer' })
  completionTokens: number;

  @Column({ type: 'integer' })
  totalTokens: number;

  @Column({ type: 'real' })
  estimatedCost: number;

  @CreateDateColumn()
  createdAt: Date;
}
