import { Controller, Get, Post, Delete, Param, Body, Put } from '@nestjs/common';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Post()
  create(@Body() body: { title?: string; projectRoot?: string }) {
    return this.sessionsService.create(body.title || '新会话', body.projectRoot);
  }

  @Get()
  findAll() {
    return this.sessionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sessionsService.remove(id);
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string) {
    return this.sessionsService.getMessages(id);
  }

  @Put(':id/project')
  setProjectRoot(@Param('id') id: string, @Body() body: { projectRoot: string }) {
    return this.sessionsService.setProjectRoot(id, body.projectRoot);
  }

  @Put(':id/review')
  setReview(@Param('id') id: string, @Body() body: { reviewEnabled: boolean }) {
    return this.sessionsService.setReview(id, body.reviewEnabled);
  }

  @Put(':id/title')
  rename(@Param('id') id: string, @Body() body: { title: string }) {
    return this.sessionsService.rename(id, body.title);
  }
}
