import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileSystemService {
  private readonly logger = new Logger(FileSystemService.name);
  private _unrestricted = false;

  get unrestricted() { return this._unrestricted; }
  set unrestricted(val: boolean) { this._unrestricted = val; }

  async readFile(projectRoot: string, filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const fullPath = this.resolveSafePath(projectRoot, filePath);
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: `文件不存在: ${filePath}` };
      }
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return { success: false, error: `这是一个目录: ${filePath}` };
      }
      if (stat.size > 5 * 1024 * 1024) {
        return { success: false, error: `文件太大 (${(stat.size / 1024 / 1024).toFixed(1)}MB, 限制5MB)` };
      }
      const content = fs.readFileSync(fullPath, 'utf-8');
      this.logger.log(`Read file: ${fullPath} (${content.length} chars)${this._unrestricted ? ' [unrestricted]' : ''}`);
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async writeFile(projectRoot: string, filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = this.resolveSafePath(projectRoot, filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, 'utf-8');
      this.logger.log(`Wrote file: ${fullPath} (${content.length} chars)${this._unrestricted ? ' [unrestricted]' : ''}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listFiles(projectRoot: string, dirPath: string = '.'): Promise<{ success: boolean; files?: string[]; error?: string }> {
    try {
      const fullPath = this.resolveSafePath(projectRoot, dirPath);
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: `目录不存在: ${dirPath}` };
      }
      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      const files = entries.map(e => (e.isDirectory() ? '[DIR] ' : '') + e.name).sort();
      return { success: true, files };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkProjectRoot(projectRoot: string): Promise<{ exists: boolean; files?: string[]; error?: string }> {
    try {
      if (!projectRoot || !fs.existsSync(projectRoot)) {
        return { exists: false, error: `目录不存在: ${projectRoot}` };
      }
      const entries = fs.readdirSync(projectRoot).slice(0, 50);
      return { exists: true, files: entries };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  }

  private resolveSafePath(projectRoot: string, filePath: string): string {
    // Unrestricted mode: resolve path freely, allow absolute paths
    if (this._unrestricted) {
      return path.resolve(filePath);
    }

    // Restricted mode: path must stay within projectRoot
    if (!projectRoot) {
      throw new Error('未设置项目目录，无法操作文件');
    }
    const resolved = path.resolve(projectRoot, filePath);
    const normalizedRoot = path.resolve(projectRoot);
    if (!resolved.startsWith(normalizedRoot)) {
      throw new Error(`路径越界: ${filePath} 超出项目目录`);
    }
    return resolved;
  }
}
