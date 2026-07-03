import { Injectable, Logger } from '@nestjs/common';
import { TaskGraph } from './dag-builder.service';
import { TaskResult } from './task-executor.service';
import { LLMGatewayService } from '../llm-gateway/llm-gateway.service';

@Injectable()
export class ResultAggregatorService {
  private readonly logger = new Logger(ResultAggregatorService.name);

  constructor(private llmGateway: LLMGatewayService) {}

  async aggregate(
    graph: TaskGraph,
    results: Record<string, TaskResult>,
    originalRequest: string,
    summarizerAgent?: any,
  ): Promise<string> {
    const completed = graph.nodes
      .filter(n => results[n.id]?.status === 'completed')
      .map(n => ({ name: n.name, agentName: results[n.id].agentName || 'Agent', output: results[n.id].output }));

    const failed = graph.nodes
      .filter(n => results[n.id]?.status === 'failed')
      .map(n => ({ name: n.name, error: results[n.id].error }));

    if (completed.length === 0) {
      return '所有任务都执行失败了。请检查Agent配置和模型连接。';
    }

    if (completed.length === 1 && failed.length === 0) {
      return completed[0].output;
    }

    // Build synthesis prompt
    const synthesisPrompt = `你是一个项目总结汇报专家。用户提出了一个需求，系统安排了多个Agent协作完成。

用户原始请求: ${originalRequest}

各Agent完成的工作:
${completed.map((t, i) => `【${t.agentName} - ${t.name}】:\n${t.output}`).join('\n\n---\n\n')}
${failed.length > 0 ? `\n失败的任务:\n${failed.map(f => `- ${f.name}: ${f.error}`).join('\n')}` : ''}

请撰写一份详细的工作总结报告，包含:
1. **任务概述**: 简述用户的原始需求和整体方案
2. **完成情况**: 每个Agent完成了什么工作，产出了什么
3. **关键成果**: 列出所有完成的具体交付物
4. **当前进度**: 项目整体完成度评估
5. **后续建议**: 如果有未完成的部分，给出下一步建议

请用清晰的中文撰写报告。`;

    try {
      const provider = summarizerAgent?.model?.provider || 'dashscope-coding';
      const model = summarizerAgent?.model?.modelId || 'qwen3.7-plus';

      const response = await this.llmGateway.call({
        provider, model,
        messages: [
          ...(summarizerAgent?.systemPrompt ? [{ role: 'system' as const, content: summarizerAgent.systemPrompt }] : []),
          { role: 'user', content: synthesisPrompt },
        ],
        temperature: 0.5,
        maxTokens: 4096,
      });
      return response.content;
    } catch (error) {
      this.logger.warn(`Summarizer LLM call failed, using simple concat: ${error.message}`);
      return completed.map(t => `## ${t.agentName} - ${t.name}\n\n${t.output}`).join('\n\n---\n\n');
    }
  }
}
