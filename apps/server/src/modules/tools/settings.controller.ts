import { Controller, Get, Put, Body } from '@nestjs/common';
import { FileSystemService } from './filesystem.service';

@Controller('settings')
export class SettingsController {
  constructor(private fileSystem: FileSystemService) {}

  @Get('fs-unrestricted')
  getFsUnrestricted() {
    return { unrestricted: this.fileSystem.unrestricted };
  }

  @Put('fs-unrestricted')
  setFsUnrestricted(@Body() body: { unrestricted: boolean }) {
    this.fileSystem.unrestricted = body.unrestricted;
    return { unrestricted: this.fileSystem.unrestricted };
  }
}
