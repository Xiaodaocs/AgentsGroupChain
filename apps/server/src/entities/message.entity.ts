import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('messages')
export class MessageEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  sessionId: string;

  @Column({ nullable: true })
  taskId: string;

  @Column({ nullable: true })
  fromAgentId: string;

  @Column({ nullable: true })
  toAgentId: string;

  @Column()
  role: string;  // user | assistant | system | tool

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  toolCalls: string;  // JSON

  @Column({ type: 'text', nullable: true })
  toolResults: string;  // JSON

  @Column({ type: 'text', default: '{}' })
  metadata: string;  // JSON

  @CreateDateColumn()
  createdAt: Date;
}
