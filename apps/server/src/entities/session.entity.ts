import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ default: 'auto' })
  taskType: string;  // auto | question | simple | build

  @Column({ nullable: true })
  projectRoot: string;

  @Column({ default: 1 })
  reviewEnabled: number;  // 1 = dispatcher reviews every step, 0 = skip review  // local project directory for file operations

  @Column({ type: 'real', default: 0 })
  totalCost: number;

  @Column({ type: 'integer', default: 0 })
  totalTokens: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
