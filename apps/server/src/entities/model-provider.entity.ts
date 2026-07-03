import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('model_providers')
export class ModelProviderEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  provider: string;  // openai | anthropic | groq | gemini | ollama | deepseek | openrouter | mistral

  @Column()
  displayName: string;

  @Column({ nullable: true })
  apiKey: string;  // encrypted

  @Column({ nullable: true })
  baseUrl: string;

  @Column({ default: 1 })
  isEnabled: number;

  @Column({ type: 'integer', default: 60 })
  rateLimitRPM: number;

  @Column({ type: 'integer', default: 10000 })
  rateLimitRPD: number;

  @Column({ nullable: true })
  defaultModel: string;

  @Column({ type: 'text', default: '[]' })
  models: string;  // JSON array of model info

  @CreateDateColumn()
  createdAt: Date;
}
