import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tasks')
export class TaskEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  sessionId: string;

  @Column({ nullable: true })
  parentTaskId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  type: string;  // decompose | execute | aggregate | validate

  @Column({ type: 'text' })
  input: string;  // JSON: TaskInput

  @Column({ type: 'text', nullable: true })
  expectedOutput: string;

  @Column({ type: 'text', nullable: true })
  actualOutput: string;

  @Column()
  assignedAgentId: string;

  @Column({ nullable: true })
  fallbackAgentId: string;

  @Column({ type: 'text', default: '[]' })
  dependsOn: string;  // JSON array of task IDs

  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'integer', default: 0 })
  progress: number;

  @Column({ type: 'integer', default: 0 })
  attempt: number;

  @Column({ type: 'integer', default: 3 })
  maxAttempts: number;

  @Column({ type: 'integer', default: 30000 })
  timeout: number;

  @Column({ type: 'text', nullable: true })
  tokensUsed: string;  // JSON

  @Column({ type: 'real', default: 0 })
  estimatedCost: number;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ type: 'text', nullable: true })
  error: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
