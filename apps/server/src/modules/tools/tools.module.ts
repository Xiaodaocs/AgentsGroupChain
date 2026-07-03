import { Module } from '@nestjs/common';
import { FileSystemService } from './filesystem.service';
import { SettingsController } from './settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [FileSystemService],
  exports: [FileSystemService],
})
export class ToolsModule {}
