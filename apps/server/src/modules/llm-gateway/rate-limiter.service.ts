import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly requestCounts = new Map<string, { count: number; resetAt: number }>();

  // Default limits per provider (requests per minute)
  private readonly defaultLimits: Record<string, number> = {
    'openai': 60,
    'anthropic': 60,
    'groq': 30,
    'gemini': 15,
    'ollama': 999,
    'deepseek': 60,
    'openrouter': 20,
    'mistral': 30,
    'dashscope-coding': 60,
  };

  async checkLimit(provider: string): Promise<void> {
    const now = Date.now();
    const key = `${provider}:rpm`;
    const limit = this.defaultLimits[provider] || 60;

    let entry = this.requestCounts.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + 60_000 };
      this.requestCounts.set(key, entry);
    }

    entry.count++;

    if (entry.count > limit) {
      const waitMs = entry.resetAt - now;
      this.logger.warn(`Rate limit for ${provider}: waiting ${waitMs}ms`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      // Reset after wait
      this.requestCounts.set(key, { count: 1, resetAt: Date.now() + 60_000 });
    }
  }
}
