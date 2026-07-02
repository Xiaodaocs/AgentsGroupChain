import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('agents')
export class AgentEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ type: 'text' })
  systemPrompt: string;

  @Column({ type: 'text', default: '{}' })
  roleDefinition: string;     // JSON string

  @Column({ type: 'text', default: '{}' })
  modelConfig: string;        // JSON string: {provider, modelId, temperature, maxTokens, ...}

  @Column({ type: 'text', default: '[]' })
  tools: string;              // JSON array

  @Column({ type: 'text', default: '{}' })
  behavior: string;           // JSON: {maxRetries, timeout, enableMemory, ...}

  @Column({ type: 'text', default: '{}' })
  costConfig: string;         // JSON: {tokenBudget, costBudget, priority}

  @Column({ type: 'text', default: '{}' })
  collaboration: string;      // JSON: {canDelegateTo, canReceiveFrom, ...}

  @Column({ type: 'text', default: '[]' })
  tags: string;               // JSON array

  @Column({ default: 'active' })
  status: string;

  @Column({ default: 0 })
  isTemplate: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
