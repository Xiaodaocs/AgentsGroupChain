import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';

@Controller('orchestrator')
export class OrchestratorController {
  constructor(private orchestrator: OrchestratorService) {}

  @Post('chat')
  chat(@Body() body: { sessionId: string; message: string; taskType?: string }) {
    return this.orchestrator.handleChat(body.sessionId, body.message, body.taskType);
  }

  @Get('sessions/:id/tasks')
  getSessionTasks(@Param('id') id: string) {
    return this.orchestrator.getSessionTasks(id);
  }

  @Get('tasks/:id')
  getTask(@Param('id') id: string) {
    return this.orchestrator.getTask(id);
  }

  @Post('tasks/:id/retry')
  retryTask(@Param('id') id: string) {
    return this.orchestrator.retryTask(id);
  }

  @Post('tasks/:id/cancel')
  cancelTask(@Param('id') id: string) {
    return this.orchestrator.cancelTask(id);
  }

  @Post('sessions/:id/cancel')
  cancelSession(@Param('id') id: string) {
    const cancelled = this.orchestrator.cancelSession(id);
    return { success: cancelled, message: cancelled ? '已停止' : '没有运行中的任务' };
  }
}
