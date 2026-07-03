import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('agent_templates')
export class AgentTemplateEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ type: 'text' })
  systemPrompt: string;

  @Column({ type: 'text' })
  roleDefinition: string;  // JSON

  @Column({ type: 'text', default: '[]' })
  recommendedModels: string;  // JSON

  @Column({ type: 'text', default: '[]' })
  defaultTools: string;  // JSON

  @Column({ type: 'text', default: '[]' })
  tags: string;  // JSON array

  @CreateDateColumn()
  createdAt: Date;
}
