import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Post()
  create(@Body() body: any) {
    return this.agentsService.create(body);
  }

  @Get()
  findAll() {
    return this.agentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.agentsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.agentsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.agentsService.remove(id);
  }

  @Post(':id/test')
  testAgent(@Param('id') id: string, @Body() body: any) {
    return this.agentsService.testAgent(id, body.message);
  }
}
