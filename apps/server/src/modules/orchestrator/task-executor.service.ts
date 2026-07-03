import { Injectable, Logger } from '@nestjs/common';
import { DAGBuilderService, TaskNode, TaskGraph } from './dag-builder.service';
import { AgentsService } from '../agents/agents.service';
import { LLMGatewayService, ChatMessage } from '../llm-gateway/llm-gateway.service';
import { CostTrackerService } from '../llm-gateway/cost-tracker.service';

export interface TaskResult {
  status: 'completed' | 'failed';
  output?: any;
  error?: string;
  durationMs: number;
  tokensUsed?: { promptTokens: number; completionTokens: number; totalTokens: number };
  estimatedCost?: number;
  agentName?: string;
  modelId?: string;
}

@Injectable()
export class TaskExecutorService {
  private readonly logger = new Logger(TaskExecutorService.name);

  constructor(
    private agentsService: AgentsService,
    private llmGateway: LLMGatewayService,
    private costTracker: CostTrackerService,
  ) {}

  async executeGraph(
    graph: TaskGraph,
    sessionId: string,
    onEvent: (event: any) => void,
  ): Promise<Record<string, TaskResult>> {
    const results: Record<string, TaskResult> = {};
    const levels = this.topologicalLevels(graph);

    // Build a lookup for node info
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

    for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
      const level = levels[levelIdx];

      // Announce level execution
      if (level.length > 1) {
        onEvent({
          type: 'parallel:start',
          taskIds: level.map(n => n.id),
          message: `${level.length} 个任务并行执行中`,
        });
      }

      const promises = level.map(async (node) => {
        // Collect dependency outputs
        const dependencyOutputs: Record<string, any> = {};
        const depSources: { taskId: string; taskName: string; agentName: string; outputPreview: string }[] = [];

        for (const depId of node.dependsOn) {
          if (results[depId]?.output) {
            dependencyOutputs[depId] = results[depId].output;
            const depNode = nodeMap.get(depId);
            const outputStr = typeof results[depId].output === 'string'
              ? results[depId].output.substring(0, 300)
              : JSON.stringify(results[depId].output)?.substring(0, 300);
            depSources.push({
              taskId: depId,
              taskName: depNode?.name || depId,
              agentName: results[depId].agentName || 'Unknown',
              outputPreview: outputStr,
            });
          }
        }

        // Get agent info
        const agent = await this.agentsService.findOne(node.assignedAgentId).catch(() => null);
        const agentName = agent?.name || 'Unknown';
        const modelId = agent?.model?.modelId || 'unknown';
        const provider = agent?.model?.provider || 'unknown';

        // ── Event: Task assigned ──
        onEvent({
          type: 'task:assigned',
          taskId: node.id,
          agentId: node.assignedAgentId,
          agentName,
          modelId,
          provider,
          taskName: node.name,
          taskDescription: node.description,
          message: `${agentName} 接收到任务「${node.name}」`,
        });

        // ── Event: Receiving data from upstream agents ──
        if (depSources.length > 0) {
          onEvent({
            type: 'agent:receive',
            taskId: node.id,
            agentId: node.assignedAgentId,
            agentName,
            fromAgents: depSources.map(d => ({
              agentName: d.agentName,
              taskName: d.taskName,
              outputPreview: d.outputPreview,
            })),
            message: `${agentName} 收到来自 ${depSources.map(d => d.agentName).join('、')} 的结果`,
          });
        }

        // ── Event: Agent thinking ──
        onEvent({
          type: 'agent:thinking',
          taskId: node.id,
          agentId: node.assignedAgentId,
          agentName,
          modelId,
          message: `${agentName} 正在分析任务并生成回复...`,
        });

        try {
          const startTime = Date.now();

          const result = await this.executeNode(node, dependencyOutputs, sessionId, agent);
          results[node.id] = result;

          // Truncate output for preview
          const fullOutput = typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2);
          const outputPreview = fullOutput.substring(0, 300) + (fullOutput.length > 300 ? '...' : '');

          // ── Event: Task completed ──
          onEvent({
            type: 'task:completed',
            taskId: node.id,
            status: 'completed',
            progress: 100,
            agentId: node.assignedAgentId,
            agentName: result.agentName || agentName,
            modelId: result.modelId || modelId,
            provider,
            taskName: node.name,
            output: fullOutput,
            outputPreview,
            durationMs: result.durationMs,
            tokensUsed: result.tokensUsed,
            estimatedCost: result.estimatedCost,
            message: `${agentName} 完成了任务「${node.name}」`,
          });

        } catch (error) {
          this.logger.error(`Task "${node.name}" failed: ${error.message}`, error.stack);
          results[node.id] = {
            status: 'failed',
            error: error.message,
            durationMs: 0,
            agentName,
            modelId,
          };

          // ── Event: Task failed ──
          onEvent({
            type: 'task:failed',
            taskId: node.id,
            status: 'failed',
            agentId: node.assignedAgentId,
            agentName,
            modelId,
            error: error.message,
            message: `${agentName} 执行任务「${node.name}」失败: ${error.message}`,
          });
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  private async executeNode(
    node: TaskNode,
    dependencyOutputs: Record<string, any>,
    sessionId: string,
    agent: any,
  ): Promise<TaskResult> {
    const startTime = Date.now();

    if (!agent) {
      throw new Error(`Agent ${node.assignedAgentId} not found`);
    }

    this.logger.log(`Executing task "${node.name}" with agent "${agent.name}" (model: ${agent.model?.provider}/${agent.model?.modelId})`);

    const systemPrompt = this.buildSystemPrompt(agent);
    const userPrompt = this.buildTaskPrompt(node, dependencyOutputs);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llmGateway.call({
      provider: agent.model.provider,
      model: agent.model.modelId,
      messages,
      temperature: agent.model.temperature,
      maxTokens: agent.model.maxTokens,
    });

    await this.costTracker.trackUsage({
      sessionId,
      agentId: agent.id,
      provider: agent.model.provider,
      model: agent.model.modelId,
      usage: response.usage,
      estimatedCost: response.estimatedCost,
    });

    return {
      status: 'completed',
      output: response.content,
      durationMs: Date.now() - startTime,
      tokensUsed: response.usage,
      estimatedCost: response.estimatedCost,
      agentName: agent.name,
      modelId: agent.model.modelId,
    };
  }

  private buildSystemPrompt(agent: any): string {
    const parts = [agent.systemPrompt];
    if (agent.roleDefinition) {
      const role = agent.roleDefinition;
      if (role.role) parts.push(`\n你的角色: ${role.role}`);
      if (role.goal) parts.push(`你的目标: ${role.goal}`);
      if (role.constraints?.length) {
        parts.push(`约束条件:\n${role.constraints.map((c: string) => `- ${c}`).join('\n')}`);
      }
    }
    return parts.join('\n');
  }

  private buildTaskPrompt(node: TaskNode, dependencyOutputs: Record<string, any>): string {
    const parts = [`请完成以下任务:\n\n任务: ${node.name}\n描述: ${node.description}`];
    if (node.input?.description) {
      parts.push(`\n具体要求: ${node.input.description}`);
    }
    if (Object.keys(dependencyOutputs).length > 0) {
      parts.push('\n\n以下是其他Agent协作完成的成果，请在此基础上继续:');
      for (const [taskId, output] of Object.entries(dependencyOutputs)) {
        const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
        parts.push(`\n[协作者输出]:\n${outputStr}`);
      }
    }
    if (node.expectedOutput) {
      parts.push(`\n\n期望输出: ${node.expectedOutput}`);
    }
    return parts.join('\n');
  }

  private topologicalLevels(graph: TaskGraph): TaskNode[][] {
    const levels: TaskNode[][] = [];
    const remaining = new Map(graph.nodes.map(n => [n.id, n]));
    const completed = new Set<string>();

    while (remaining.size > 0) {
      const level: TaskNode[] = [];
      for (const [id, node] of remaining) {
        if (node.dependsOn.every(dep => completed.has(dep))) {
          level.push(node);
        }
      }
      if (level.length === 0) {
        this.logger.warn('Circular dependency detected, forcing execution');
        level.push(remaining.values().next().value);
      }
      levels.push(level);
      for (const node of level) {
        completed.add(node.id);
        remaining.delete(node.id);
      }
    }
    return levels;
  }
}
