import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from '../../entities/task.entity';
import { SessionEntity } from '../../entities/session.entity';
import { AgentsService } from '../agents/agents.service';
import { SessionsService } from '../sessions/sessions.service';
import { EventsGateway } from '../websocket/events.gateway';
import { LLMGatewayService, ChatMessage } from '../llm-gateway/llm-gateway.service';
import { DAGBuilderService } from './dag-builder.service';
import { FileSystemService } from '../tools/filesystem.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(
    @InjectRepository(TaskEntity) private taskRepo: Repository<TaskEntity>,
    @InjectRepository(SessionEntity) private sessionRepo: Repository<SessionEntity>,
    private agentsService: AgentsService,
    private sessionsService: SessionsService,
    private eventsGateway: EventsGateway,
    private llmGateway: LLMGatewayService,
    private dagBuilder: DAGBuilderService,
    private fileSystem: FileSystemService,
  ) {}

  async handleChat(sessionId: string, userMessage: string, taskType?: string): Promise<any> {
    this.logger.log(`Chat [${taskType || 'auto'}] session=${sessionId}: ${userMessage.substring(0, 80)}...`);

    // Create abort controller for this session
    const abortController = new AbortController();
    this.abortControllers.set(sessionId, abortController);
    const signal = abortController.signal;

    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    const reviewEnabled = session?.reviewEnabled !== 0;
    const projectRoot = session?.projectRoot || null;

    await this.sessionsService.addMessage({ sessionId, role: 'user', content: userMessage });

    // Build session context from message history (Dispatcher's memory)
    const allMessages = await this.sessionsService.getMessages(sessionId);
    const sessionContext = this.buildSessionContext(allMessages);

    const allAgents = await this.agentsService.findAll();
    if (allAgents.length === 0) {
      const err = '没有可用的Agent，请先创建Agent。';
      await this.sessionsService.addMessage({ sessionId, role: 'assistant', content: err });
      return { sessionId, tasks: [], aggregatedResult: err };
    }

    // Find dispatcher (agent with planning/management tag, or first agent)
    const dispatcher = allAgents.find(a => a.tags?.includes('planning') || a.tags?.includes('management')) || allAgents[0];
    const workerAgents = allAgents.filter(a => a.id !== dispatcher.id);

    // Validate model configs — fallback to dashscope-coding/qwen3.7-plus if missing
    const DEFAULT_MODEL = { provider: 'dashscope-coding', modelId: 'qwen3.7-plus', temperature: 0.5, maxTokens: 16384 };
    for (const agent of allAgents) {
      if (!agent.model?.provider) {
        this.logger.warn(`Agent "${agent.name}" missing provider, using default`);
        agent.model = { ...DEFAULT_MODEL, ...agent.model };
      }
    }

    // Resolve task type
    const resolvedType = (!taskType || taskType === 'auto')
      ? await this.classifyTask(userMessage, dispatcher)
      : taskType;

    this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'session:classified', taskType: resolvedType, agentName: dispatcher.name, message: `${dispatcher.name} 判断任务类型: ${resolvedType}` });

    if (resolvedType === 'question' || resolvedType === 'simple') {
      return this.handleSimple(sessionId, userMessage, resolvedType, dispatcher, projectRoot, sessionContext);
    }
    return this.handleBuild(sessionId, userMessage, dispatcher, workerAgents, reviewEnabled, projectRoot, signal, sessionContext);
  }

  // ═══════════════════════════════════════════════════════════════
  // SIMPLE: Dispatcher answers directly
  // ═══════════════════════════════════════════════════════════════
  private async handleSimple(sessionId: string, userMessage: string, taskType: string, dispatcher: any, projectRoot: string | null, sessionContext: string): Promise<any> {
    const taskId = uuid();
    this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'task:assigned', taskId, agentId: dispatcher.id, agentName: dispatcher.name, modelId: dispatcher.model?.modelId, taskName: taskType === 'question' ? '回答问题' : '执行任务', message: `${dispatcher.name} 直接处理` });
    this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'agent:thinking', taskId, agentId: dispatcher.id, agentName: dispatcher.name, modelId: dispatcher.model?.modelId, message: `${dispatcher.name} 正在思考...` });

    try {
      const systemMsg = `${dispatcher.systemPrompt}\n\n请直接清晰地回答用户。${sessionContext ? '\n\n=== 历史上下文 ===\n' + sessionContext + '\n=== 上下文结束 ===\n\n请基于以上上下文回答用户的问题。如果用户询问之前Agent的工作情况，请根据上下文中的信息回答。' : ''}`;
      const response = await this.llmGateway.call({
        provider: dispatcher.model.provider, model: dispatcher.model.modelId,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMessage },
        ],
        temperature: dispatcher.model.temperature, maxTokens: dispatcher.model.maxTokens,
      });

      await this.saveTask(taskId, sessionId, taskType === 'question' ? '回答问题' : '执行任务', dispatcher.id, 'completed', response.content, response.usage, response.estimatedCost);
      this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'task:completed', taskId, status: 'completed', progress: 100, agentId: dispatcher.id, agentName: dispatcher.name, modelId: dispatcher.model?.modelId, output: response.content, outputPreview: response.content.substring(0, 300), durationMs: response.latencyMs, tokensUsed: response.usage, message: `${dispatcher.name} 完成` });
      await this.sessionsService.addMessage({ sessionId, role: 'assistant', content: response.content, metadata: { type: 'final_result', agentName: dispatcher.name } });
      this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'session:result', sessionId, aggregatedResult: response.content });
      return { sessionId, tasks: [{ id: taskId, name: '回答', status: 'completed', output: response.content }], aggregatedResult: response.content };
    } catch (error) {
      const errMsg = `执行出错: ${error.message}`;
      await this.sessionsService.addMessage({ sessionId, role: 'assistant', content: errMsg });
      return { sessionId, tasks: [], aggregatedResult: errMsg };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILD: Dispatcher plans → assigns → reviews → summarizes
  // ═══════════════════════════════════════════════════════════════
  private async handleBuild(sessionId: string, userMessage: string, dispatcher: any, workerAgents: any[], reviewEnabled: boolean, projectRoot: string | null, signal?: AbortSignal, sessionContext: string = ''): Promise<any> {
    // ── Step 1: Dispatcher plans ──
    this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'agent:thinking', taskId: 'planner', agentId: dispatcher.id, agentName: dispatcher.name, modelId: dispatcher.model?.modelId, message: `${dispatcher.name} 正在分析需求、规划任务和分配Agent...` });

    const plan = await this.dispatcherPlan(userMessage, dispatcher, workerAgents, projectRoot, sessionContext);
    this.logger.log(`Dispatcher plan: ${plan.tasks.length} tasks, review=${reviewEnabled}`);

    // Build DAG from plan
    const taskGraph = this.dagBuilder.build(plan);

    // Save tasks
    for (const node of taskGraph.nodes) {
      await this.taskRepo.save(this.taskRepo.create({
        id: node.id, sessionId, name: node.name, description: node.description, type: node.type,
        input: JSON.stringify(node.input), assignedAgentId: node.assignedAgentId,
        dependsOn: JSON.stringify(node.dependsOn), status: 'pending', maxAttempts: 3, timeout: 1800000,
      }));
    }

    this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'task:created', sessionId, nodes: taskGraph.nodes, edges: taskGraph.edges });

    // ── Step 2: Execute with review gates ──
    const results: Record<string, any> = {};
    const levels = this.topologicalLevels(taskGraph);

    try {
      for (const level of levels) {
        if (signal?.aborted) {
          this.logger.log(`Session ${sessionId} cancelled`);
          this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'session:cancelled', sessionId, message: '任务已被用户停止' });
          break;
        }
        if (level.length > 1) {
          this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'parallel:start', taskIds: level.map(n => n.id), message: `${level.length} 个任务并行执行` });
        }

        const promises = level.map(async (node) => {
          if (signal?.aborted) return;
          // Collect dependency outputs
          const depOutputs: Record<string, any> = {};
          for (const depId of node.dependsOn) {
            if (results[depId]?.output) depOutputs[depId] = results[depId].output;
          }

          // Get agent
          const agent = workerAgents.find(a => a.id === node.assignedAgentId) || workerAgents[0];
          const agentName = agent.name;

          // ── Event: assigned ──
          this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'task:assigned', taskId: node.id, agentId: agent.id, agentName, modelId: agent.model?.modelId, provider: agent.model?.provider, taskName: node.name, taskDescription: node.description, message: `${dispatcher.name} 分配「${node.name}」给 ${agentName}` });

          // ── Event: thinking ──
          this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'agent:thinking', taskId: node.id, agentId: agent.id, agentName, modelId: agent.model?.modelId, message: `${agentName} 正在执行「${node.name}」...` });

          try {
            const startTime = Date.now();

            // Build prompt with context from dependencies
            const taskPrompt = this.buildTaskPrompt(node, depOutputs, projectRoot);
            const response = await this.llmGateway.call({
              provider: agent.model.provider, model: agent.model.modelId,
              messages: [
                { role: 'system', content: agent.systemPrompt },
                { role: 'user', content: taskPrompt },
              ],
              temperature: agent.model.temperature, maxTokens: agent.model.maxTokens,
            });

            let output = response.content;

            // ── Process file operations if projectRoot is set or unrestricted mode ──
            if (projectRoot || this.fileSystem.unrestricted) {
              output = await this.processFileOperations(output, projectRoot, sessionId, node.id);
            }

            const outputPreview = output.substring(0, 300) + (output.length > 300 ? '...' : '');

            results[node.id] = { output, agentName, agentId: agent.id, status: 'completed', durationMs: Date.now() - startTime, tokensUsed: response.usage, estimatedCost: response.estimatedCost };

            // ── Event: completed ──
            this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'task:completed', taskId: node.id, status: 'completed', progress: 100, agentId: agent.id, agentName, modelId: agent.model?.modelId, output, outputPreview, durationMs: Date.now() - startTime, tokensUsed: response.usage, estimatedCost: response.estimatedCost, message: `${agentName} 完成「${node.name}」` });

            // Save task to DB
            await this.taskRepo.update(node.id, { status: 'completed', actualOutput: output, startedAt: new Date(startTime), completedAt: new Date(), tokensUsed: JSON.stringify(response.usage), estimatedCost: response.estimatedCost });

            // ── REVIEW GATE ──
            if (reviewEnabled) {
              this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'agent:thinking', taskId: `review-${node.id}`, agentId: dispatcher.id, agentName: dispatcher.name, modelId: dispatcher.model?.modelId, message: `${dispatcher.name} 正在审查 ${agentName} 的成果...` });

              const review = await this.dispatcherReview(dispatcher, node.name, agentName, output, userMessage);

              if (review.approved) {
                this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'task:completed', taskId: `review-${node.id}`, status: 'completed', agentId: dispatcher.id, agentName: dispatcher.name, message: `${dispatcher.name} 审查通过: ${review.comment}`, outputPreview: review.comment });
              } else {
                // Review failed — try to fix with same agent
                this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'task:failed', taskId: `review-${node.id}`, agentId: dispatcher.id, agentName: dispatcher.name, error: review.comment, message: `${dispatcher.name} 审查未通过: ${review.comment}。要求 ${agentName} 修改...` });

                const fixPrompt = `你的工作成果未通过审查。\n\n审查意见: ${review.comment}\n\n原始任务: ${node.name}\n你的原始输出:\n${output}\n\n请根据审查意见修改并重新提交。`;
                const fixResponse = await this.llmGateway.call({
                  provider: agent.model.provider, model: agent.model.modelId,
                  messages: [{ role: 'system', content: agent.systemPrompt }, { role: 'user', content: fixPrompt }],
                  temperature: agent.model.temperature, maxTokens: agent.model.maxTokens,
                });

                results[node.id] = { ...results[node.id], output: fixResponse.content };
                this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'task:completed', taskId: node.id, agentId: agent.id, agentName, output: fixResponse.content, outputPreview: fixResponse.content.substring(0, 300), message: `${agentName} 已修改并重新提交` });
                await this.taskRepo.update(node.id, { actualOutput: fixResponse.content });
              }
            }

          } catch (error) {
            this.logger.error(`Task "${node.name}" failed: ${error.message}`);
            results[node.id] = { status: 'failed', error: error.message, agentName };
            this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'task:failed', taskId: node.id, agentId: agent.id, agentName, error: error.message, message: `${agentName} 执行失败: ${error.message}` });
            await this.taskRepo.update(node.id, { status: 'failed', error: error.message });
          }
        });

        await Promise.all(promises);
      }

      // ── Step 3: Dispatcher produces final summary ──
      this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'agent:thinking', taskId: 'summarizer', agentId: dispatcher.id, agentName: dispatcher.name, modelId: dispatcher.model?.modelId, message: `${dispatcher.name} 正在汇总所有工作成果...` });

      const summary = await this.dispatcherSummarize(dispatcher, userMessage, taskGraph, results, sessionContext);

      await this.sessionsService.addMessage({ sessionId, role: 'assistant', content: summary, metadata: { type: 'final_result', agentName: dispatcher.name } });
      this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'session:result', sessionId, aggregatedResult: summary });

      return {
        sessionId,
        tasks: taskGraph.nodes.map(n => ({ id: n.id, name: n.name, status: results[n.id]?.status || 'completed', output: results[n.id]?.output })),
        aggregatedResult: summary,
      };

    } catch (error) {
      this.logger.error(`Build failed: ${error.message}`, error.stack);
      const errMsg = `任务执行出错: ${error.message}`;
      await this.sessionsService.addMessage({ sessionId, role: 'assistant', content: errMsg });
      this.eventsGateway.emitOrchestratorEvent(sessionId, { type: 'session:result', sessionId, aggregatedResult: errMsg });
      return { sessionId, tasks: [], aggregatedResult: errMsg };
    } finally {
      this.abortControllers.delete(sessionId);
    }
  }

  // ── Cancel running session ──
  cancelSession(sessionId: string): boolean {
    const controller = this.abortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(sessionId);
      this.logger.log(`Cancelled session ${sessionId}`);
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // DISPATCHER: Plan
  // ═══════════════════════════════════════════════════════════════
  private async dispatcherPlan(userMessage: string, dispatcher: any, workerAgents: any[], projectRoot: string | null, sessionContext: string = ''): Promise<any> {
    const agentList = workerAgents.map(a => `- ${a.id}: ${a.name} (标签: ${a.tags?.join(', ') || '无'}, 模型: ${a.model?.modelId || 'unknown'})`).join('\n');

    const contextBlock = sessionContext ? `\n\n=== 历史上下文（之前Agent的工作记录） ===\n${sessionContext}\n=== 上下文结束 ===\n\n请基于以上上下文规划新的任务，避免重复已完成的工作。\n` : '';

    const prompt = `你是项目分配者。分析用户需求，制定执行计划。${contextBlock}

可用Worker Agent列表:
${agentList}

${projectRoot ? `项目目录: ${projectRoot} (Agent可以读写此目录的文件)` : ''}

规则:
1. 根据任务需要选择合适的Agent，可以只用部分Agent
2. 明确任务之间的依赖关系（哪些并行、哪些串行）
3. 每个任务描述要具体、可执行
4. 任务ID格式: task_1, task_2, ...
5. 无依赖的任务可以并行执行

只返回JSON，不要其他内容:
{
  "strategy": "sequential | parallel | hybrid",
  "tasks": [
    {
      "id": "task_1",
      "name": "任务名称",
      "description": "具体要做什么",
      "assignedAgentId": "agent的id",
      "dependsOn": [],
      "input": { "description": "详细要求" },
      "expectedOutput": "期望输出描述"
    }
  ]
}`;

    try {
      const response = await this.llmGateway.call({
        provider: dispatcher.model.provider, model: dispatcher.model.modelId,
        messages: [
          { role: 'system', content: dispatcher.systemPrompt + '\n你是分配者，负责规划任务、分配Agent、决定工作顺序。' },
          { role: 'user', content: `用户需求: ${userMessage}` },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2, maxTokens: 8192,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Plan parse failed');
      const plan = JSON.parse(jsonMatch[0]);
      plan.tasks = plan.tasks.map((t: any, i: number) => ({
        ...t, id: t.id || `task_${i + 1}`, type: 'execute' as const, dependsOn: t.dependsOn || [],
      }));
      return plan;
    } catch (error) {
      this.logger.warn(`Plan failed, fallback: ${error.message}`);
      return { strategy: 'sequential', tasks: [{ id: 'task_1', name: '执行任务', description: userMessage, type: 'execute', assignedAgentId: workerAgents[0]?.id || dispatcher.id, dependsOn: [], input: { description: userMessage } }] };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DISPATCHER: Review
  // ═══════════════════════════════════════════════════════════════
  private async dispatcherReview(dispatcher: any, taskName: string, agentName: string, output: string, originalRequest: string): Promise<{ approved: boolean; comment: string }> {
    try {
      const response = await this.llmGateway.call({
        provider: dispatcher.model.provider, model: dispatcher.model.modelId,
        messages: [
          { role: 'system', content: `${dispatcher.systemPrompt}\n\n你是审查者。审查Agent的工作成果，判断是否合格。` },
          { role: 'user', content: `原始需求: ${originalRequest}\n\n任务: ${taskName}\n执行者: ${agentName}\n\nAgent的完整输出:\n${output}\n\n请审查此输出。只返回JSON:\n{"approved": true/false, "comment": "审查意见"}` },
        ],
        temperature: 0.2, maxTokens: 2000,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { approved: true, comment: '审查通过' };
      return JSON.parse(jsonMatch[0]);
    } catch {
      return { approved: true, comment: '审查通过（自动）' };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DISPATCHER: Summarize
  // ═══════════════════════════════════════════════════════════════
  private async dispatcherSummarize(dispatcher: any, originalRequest: string, taskGraph: any, results: Record<string, any>, sessionContext: string = ''): Promise<string> {
    const completed = taskGraph.nodes.filter(n => results[n.id]?.status === 'completed');
    const failed = taskGraph.nodes.filter(n => results[n.id]?.status === 'failed');

    if (completed.length === 0) return '所有任务都执行失败了。';
    if (completed.length === 1 && failed.length === 0) return completed[0].output || results[completed[0].id]?.output || '';

    const taskDetails = completed.map(n => {
      const r = results[n.id];
      return `【${r?.agentName || 'Agent'} 完成「${n.name}」】:\n${r?.output || ''}`;
    }).join('\n\n---\n\n');

    const contextBlock = sessionContext ? `\n\n=== 完整历史上下文 ===\n${sessionContext}\n=== 上下文结束 ===\n` : '';

    const prompt = `你是项目总结汇报者。以下是你和团队完成的工作。

用户原始需求: ${originalRequest}
${contextBlock}
各Agent完成的工作:
${taskDetails}
${failed.length > 0 ? `\n失败的任务:\n${failed.map(n => `- ${n.name}: ${results[n.id]?.error}`).join('\n')}` : ''}

请撰写一份详细的工作总结报告，用自然流畅的中文段落描述，使用 Markdown 格式排版。

⚠️ 重要：必须输出纯文本 Markdown 报告，禁止输出 JSON 或任何代码块格式。

报告结构:
## 📋 任务概述
描述用户需求和你制定的整体方案。

## ✅ 完成情况
逐一描述每个Agent完成了什么工作，用段落形式而非列表。

## 📦 关键交付物
列出所有具体产出文件。

## 📊 当前进度
评估整体完成度，说明当前阶段和质量状况。

## 🔜 后续建议
给出具体的下一步行动建议。`;

    try {
      const response = await this.llmGateway.call({
        provider: dispatcher.model.provider, model: dispatcher.model.modelId,
        messages: [
          { role: 'system', content: dispatcher.systemPrompt + '\n你是总结汇报者。你必须用自然语言段落撰写工作报告，使用 Markdown 格式排版。绝对不要输出 JSON、代码块或任何结构化数据格式。像写文章一样撰写报告。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5, maxTokens: 8192,
      });
      // Post-process: if LLM still returns JSON, convert to readable markdown
      let content = response.content.trim();
      if (content.startsWith('{') || content.startsWith('[')) {
        try {
          const parsed = JSON.parse(content);
          content = this.jsonToMarkdown(parsed);
        } catch {
          // Not valid JSON, return as-is
        }
      }
      return content;
    } catch {
      return completed.map(n => `## ${results[n.id]?.agentName} - ${n.name}\n\n${results[n.id]?.output}`).join('\n\n---\n\n');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════
  private async classifyTask(message: string, dispatcher: any): Promise<string> {
    try {
      const response = await this.llmGateway.call({
        provider: dispatcher.model.provider, model: dispatcher.model.modelId,
        messages: [{ role: 'user', content: `判断用户请求类型，只回复一个词:
- "question": 提问/知识问答
- "simple": 简单任务，单Agent完成
- "build": 大型构建，需多Agent协作

请求: "${message}"
只回复 question/simple/build:` }],
        temperature: 0, maxTokens: 10,
      });
      const a = response.content.trim().toLowerCase();
      if (a.includes('build')) return 'build';
      if (a.includes('question')) return 'question';
      return 'simple';
    } catch { return message.length > 50 ? 'build' : 'question'; }
  }

  private buildTaskPrompt(node: any, depOutputs: Record<string, any>, projectRoot: string | null): string {
    const parts = [`任务: ${node.name}\n描述: ${node.description}`];
    if (node.input?.description) parts.push(`具体要求: ${node.input.description}`);
    if (Object.keys(depOutputs).length > 0) {
      parts.push('\n其他Agent的协作成果（请在此基础上继续）:');
      for (const [, output] of Object.entries(depOutputs)) {
        parts.push(`\n[协作者输出]:\n${typeof output === 'string' ? output : JSON.stringify(output, null, 2)}`);
      }
    }
    if (projectRoot || this.fileSystem.unrestricted) {
      parts.push(`\n\n== 本地文件操作 ==`);
      if (this.fileSystem.unrestricted) {
        parts.push(`⚠️ 无限制模式：你可以读写电脑上的任何文件，支持绝对路径。`);
      } else {
        parts.push(`项目目录: ${projectRoot}`);
        parts.push(`你只能在项目目录内创建和修改文件。`);
      }
      parts.push(`请在输出中使用以下格式:`);
      parts.push(`创建/修改文件: [FILE_WRITE: 文件路径]`);
      parts.push(`文件内容...`);
      parts.push(`[/FILE_WRITE]`);
      parts.push(`读取文件: [FILE_READ: 文件路径]`);
      parts.push(`列出目录: [FILE_LIST: 目录路径]`);
      parts.push(`系统会自动执行这些操作并将结果返回。`);
    }
    if (node.expectedOutput) parts.push(`\n期望输出: ${node.expectedOutput}`);
    return parts.join('\n');
  }

  // ── File Operation Processing ──
  private async processFileOperations(output: string, projectRoot: string | null, sessionId: string, taskId: string): Promise<string> {
    if (!output) return output;
    if (!projectRoot && !this.fileSystem.unrestricted) return output;
    const root = projectRoot || '';
    let processed = output;
    const filesWritten: string[] = [];
    const filesRead: string[] = [];

    // Process FILE_WRITE operations
    const writeRegex = /\[FILE_WRITE:\s*([^\]]+)\]([\s\S]*?)\[\/FILE_WRITE\]/g;
    let match;
    while ((match = writeRegex.exec(output)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trim();
      this.logger.log(`File write: ${filePath} (${content.length} chars)`);

      const result = await this.fileSystem.writeFile(root, filePath, content);
      if (result.success) {
        filesWritten.push(filePath);
        this.eventsGateway.emitOrchestratorEvent(sessionId, {
          type: 'file:written', taskId, filePath, size: content.length,
          message: `写入文件: ${filePath} (${content.length} 字符)`,
        });
      } else {
        this.eventsGateway.emitOrchestratorEvent(sessionId, {
          type: 'file:error', taskId, filePath, error: result.error,
          message: `写入失败: ${filePath} - ${result.error}`,
        });
      }
      processed = processed.replace(match[0], `[已写入文件: ${filePath}${result.success ? ' ✓' : ` ✗ ${result.error}`}]`);
    }

    // Process FILE_READ operations
    const readRegex = /\[FILE_READ:\s*([^\]]+)\]/g;
    while ((match = readRegex.exec(output)) !== null) {
      const filePath = match[1].trim();
      this.logger.log(`File read: ${filePath}`);

      const result = await this.fileSystem.readFile(root, filePath);
      if (result.success) {
        filesRead.push(filePath);
        this.eventsGateway.emitOrchestratorEvent(sessionId, {
          type: 'file:read', taskId, filePath,
          message: `读取文件: ${filePath} (${result.content?.length || 0} 字符)`,
        });
        processed = processed.replace(match[0], `[文件内容: ${filePath}]\n${result.content}\n[/文件内容]`);
      } else {
        this.eventsGateway.emitOrchestratorEvent(sessionId, {
          type: 'file:error', taskId, filePath, error: result.error,
          message: `读取失败: ${filePath} - ${result.error}`,
        });
        processed = processed.replace(match[0], `[读取失败: ${filePath} - ${result.error}]`);
      }
    }

    // Process FILE_LIST operations
    const listRegex = /\[FILE_LIST:\s*([^\]]+)\]/g;
    while ((match = listRegex.exec(output)) !== null) {
      const dirPath = match[1].trim();
      const result = await this.fileSystem.listFiles(root, dirPath);
      if (result.success) {
        this.eventsGateway.emitOrchestratorEvent(sessionId, {
          type: 'file:list', taskId, dirPath, fileCount: result.files?.length || 0,
          message: `列出目录: ${dirPath} (${result.files?.length || 0} 项)`,
        });
        processed = processed.replace(match[0], `[目录内容: ${dirPath}]\n${result.files?.join('\n')}\n[/目录内容]`);
      }
    }

    if (filesWritten.length > 0 || filesRead.length > 0) {
      this.logger.log(`File operations: ${filesWritten.length} written, ${filesRead.length} read`);
    }

    return processed;
  }

  private topologicalLevels(graph: any): any[] {
    const levels: any[] = [];
    const remaining: Map<string, any> = new Map(graph.nodes.map((n: any) => [n.id, n]));
    const completed = new Set<string>();
    while (remaining.size > 0) {
      const level: any[] = [];
      for (const [id, node] of remaining) {
        if ((node.dependsOn || []).every((dep: string) => completed.has(dep))) level.push(node);
      }
      if (level.length === 0) { level.push(remaining.values().next().value); }
      levels.push(level);
      for (const node of level) { completed.add(node.id); remaining.delete(node.id); }
    }
    return levels;
  }

  private async saveTask(taskId: string, sessionId: string, name: string, agentId: string, status: string, output: string, usage: any, cost: number) {
    await this.taskRepo.save(this.taskRepo.create({
      id: taskId, sessionId, name, type: 'execute', input: JSON.stringify({}),
      assignedAgentId: agentId, dependsOn: JSON.stringify([]), status,
      actualOutput: output, tokensUsed: JSON.stringify(usage), estimatedCost: cost,
      startedAt: new Date(), completedAt: new Date(),
    }));
  }

  // ── Existing API methods ──
  async getSessionTasks(sessionId: string): Promise<any[]> {
    return (await this.taskRepo.find({ where: { sessionId }, order: { createdAt: 'ASC' } })).map(t => this.formatTask(t));
  }
  async getTask(taskId: string): Promise<any> {
    const t = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!t) throw new Error(`Task ${taskId} not found`);
    return this.formatTask(t);
  }
  async retryTask(taskId: string): Promise<any> {
    await this.taskRepo.update(taskId, { status: 'pending', error: undefined });
    return { success: true };
  }
  async cancelTask(taskId: string): Promise<any> {
    await this.taskRepo.update(taskId, { status: 'cancelled' });
    return { success: true };
  }
  // ── Build session context from message history for Dispatcher memory ──
  private buildSessionContext(messages: any[]): string {
    if (!messages || messages.length === 0) return '';
    // Only include messages that provide useful context (skip the current user message)
    const contextMessages = messages.slice(0, -1); // exclude the just-added user message
    if (contextMessages.length === 0) return '';

    const lines: string[] = [];
    for (const msg of contextMessages) {
      const agentName = msg.metadata?.agentName || msg.fromAgentId || '';
      const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? (agentName || 'AI') : msg.role;
      // Truncate long outputs to keep context manageable
      const content = (msg.content || '').substring(0, 500) + (msg.content?.length > 500 ? '...' : '');
      lines.push(`[${role}]: ${content}`);
    }
    return lines.join('\n\n');
  }

  // ── Convert JSON report to readable Markdown ──
  private jsonToMarkdown(obj: any, depth: number = 0): string {
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (Array.isArray(obj)) {
      return obj.map(item => `- ${this.jsonToMarkdown(item, depth + 1)}`).join('\n');
    }
    if (typeof obj === 'object' && obj !== null) {
      const lines: string[] = [];
      for (const [key, value] of Object.entries(obj)) {
        // Clean up key: remove leading numbers like "1_", "2_"
        const cleanKey = key.replace(/^\d+_/, '').replace(/_/g, ' ');
        const heading = depth === 0 ? '##' : depth === 1 ? '###' : '####';
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          lines.push(`\n${heading} ${cleanKey}\n\n${this.jsonToMarkdown(value, depth + 1)}`);
        } else if (Array.isArray(value)) {
          lines.push(`\n${heading} ${cleanKey}\n\n${this.jsonToMarkdown(value, depth + 1)}`);
        } else {
          lines.push(`**${cleanKey}:** ${this.jsonToMarkdown(value, depth + 1)}`);
        }
      }
      return lines.join('\n\n');
    }
    return String(obj);
  }

  private formatTask(e: TaskEntity): any {
    return {
      id: e.id, sessionId: e.sessionId, parentTaskId: e.parentTaskId, name: e.name,
      description: e.description, type: e.type, input: JSON.parse(e.input || '{}'),
      expectedOutput: e.expectedOutput,
      actualOutput: e.actualOutput ? (e.actualOutput.startsWith('{') || e.actualOutput.startsWith('[') ? JSON.parse(e.actualOutput) : e.actualOutput) : undefined,
      assignedAgentId: e.assignedAgentId, fallbackAgentId: e.fallbackAgentId,
      dependsOn: JSON.parse(e.dependsOn || '[]'), status: e.status, progress: e.progress,
      attempt: e.attempt, maxAttempts: e.maxAttempts, timeout: e.timeout,
      tokensUsed: e.tokensUsed ? JSON.parse(e.tokensUsed) : undefined,
      estimatedCost: e.estimatedCost, startedAt: e.startedAt, completedAt: e.completedAt,
      error: e.error, createdAt: e.createdAt, updatedAt: e.updatedAt,
    };
  }
}
