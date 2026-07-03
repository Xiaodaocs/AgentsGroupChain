import { Injectable, Logger } from '@nestjs/common';
import { LLMGatewayService, ChatMessage } from '../llm-gateway/llm-gateway.service';

export interface TaskPlan {
  tasks: PlannedTask[];
  strategy: 'sequential' | 'parallel' | 'hybrid';
}

export interface PlannedTask {
  id: string;
  name: string;
  description: string;
  type: 'execute';
  assignedAgentId: string;
  dependsOn: string[];
  input: {
    description: string;
    context?: Record<string, any>;
  };
  expectedOutput?: string;
}

@Injectable()
export class TaskPlannerService {
  private readonly logger = new Logger(TaskPlannerService.name);

  constructor(private llmGateway: LLMGatewayService) {}

  async plan(
    userMessage: string,
    availableAgents: any[],
    sessionId: string,
    projectRoot?: string | null,
  ): Promise<TaskPlan> {
    const agentDescriptions = availableAgents
      .map(a => `- ${a.id}: ${a.name} - ${a.description} (model: ${a.model?.provider}/${a.model?.modelId}, tags: ${a.tags?.join(', ')})`)
      .join('\n');

    const systemPrompt = `你是一个任务规划专家。你的职责是将用户的请求分解为多个子任务，并分配给合适的Agent执行。

可用Agent列表:
${agentDescriptions}

请分析用户请求，将其分解为子任务，并生成JSON格式的任务计划。

规则:
1. 每个子任务应该足够简单，单个Agent可以独立完成
2. 独立的任务应该尽量并行执行
3. 有依赖关系的任务需要明确依赖
4. 根据Agent的能力标签选择最合适的Agent
5. 如果没有合适的Agent，使用通用分析Agent

JSON输出格式:
{
  "strategy": "sequential | parallel | hybrid",
  "tasks": [
    {
      "id": "task_1",
      "name": "任务名称",
      "description": "任务详细描述",
      "assignedAgentId": "agent_id",
      "dependsOn": [],
      "input": {
        "description": "具体需要做什么",
        "context": {}
      },
      "expectedOutput": "期望的输出描述"
    }
  ]
}

只返回JSON，不要其他内容。`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    try {
      // Use a model for planning - prefer cheaper models if available
      const plannerAgent = availableAgents.find(a =>
        a.tags?.includes('planning') || a.tags?.includes('management')
      ) || availableAgents[0];

      const provider = plannerAgent?.model?.provider || 'ollama';
      const model = plannerAgent?.model?.modelId || 'llama3.2';

      const response = await this.llmGateway.call({
        provider,
        model,
        messages,
        temperature: 0.3,
        maxTokens: 4096,
      });

      const content = response.content.trim();
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse task plan from LLM response');
      }

      const plan: TaskPlan = JSON.parse(jsonMatch[0]);

      // Ensure each task has an id
      plan.tasks = plan.tasks.map((t, i) => ({
        ...t,
        id: t.id || `task_${i + 1}`,
        type: 'execute' as const,
        dependsOn: t.dependsOn || [],
      }));

      return plan;
    } catch (error) {
      this.logger.error(`Planning failed: ${error.message}`);
      // Fallback: create a single task for the whole request
      const fallbackAgent = availableAgents[0];
      return {
        strategy: 'sequential',
        tasks: [{
          id: 'task_1',
          name: '执行用户请求',
          description: userMessage,
          type: 'execute',
          assignedAgentId: fallbackAgent?.id || 'unknown',
          dependsOn: [],
          input: { description: userMessage },
        }],
      };
    }
  }
}
