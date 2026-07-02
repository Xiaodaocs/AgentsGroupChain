import { Injectable, Logger } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class TaskRouterService {
  private readonly logger = new Logger(TaskRouterService.name);

  constructor(private agentsService: AgentsService) {}

  async getAvailableAgents(): Promise<any[]> {
    const agents = await this.agentsService.findAll();
    return agents.filter(a => a.status === 'active');
  }

  // Select best agent for a task based on tags and capabilities
  async selectAgent(taskDescription: string, taskTags: string[] = []): Promise<any | null> {
    const agents = await this.getAvailableAgents();

    if (agents.length === 0) return null;

    // Score each agent based on tag overlap
    const scored = agents.map(agent => {
      const agentTags = agent.tags || [];
      const overlap = taskTags.filter(t => agentTags.includes(t)).length;
      return { agent, score: overlap };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return best match, or first agent if no tags match
    return scored[0].agent;
  }
}
