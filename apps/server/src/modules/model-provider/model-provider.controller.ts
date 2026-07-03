import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ModelProviderService } from './model-provider.service';

@Controller('providers')
export class ModelProviderController {
  constructor(private providerService: ModelProviderService) {}

  @Post()
  create(@Body() body: any) {
    return this.providerService.create(body);
  }

  @Get()
  findAll() {
    return this.providerService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.providerService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.providerService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.providerService.remove(id);
  }

  @Post('test')
  testConnection(@Body() body: { provider: string; apiKey?: string; baseUrl?: string }) {
    return this.providerService.testConnection(body.provider, body.apiKey, body.baseUrl);
  }
}
