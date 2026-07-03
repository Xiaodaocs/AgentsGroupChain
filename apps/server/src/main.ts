import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Serve frontend static files (production mode)
  const frontendDist = join(__dirname, '..', '..', 'web', 'dist');
  if (existsSync(frontendDist)) {
    app.useStaticAssets(frontendDist);
    // SPA fallback: serve index.html for all non-API routes
    app.setViewEngine('html');
    const express = app.getHttpAdapter().getInstance();
    express.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(join(frontendDist, 'index.html'));
    });
    console.log('  Frontend served from:', frontendDist);
  } else {
    console.log('  [WARN] Frontend dist not found:', frontendDist);
    console.log('  Run "npm run build" or use dev mode');
  }

  // No request timeout — multi-agent orchestration can take arbitrarily long
  const server = await app.listen(3001);
  server.setTimeout(0);        // 0 = no request timeout
  server.keepAliveTimeout = 1800000; // 30 min keep-alive (safe default)
  server.headersTimeout = 1810000;   // must be > keepAliveTimeout

  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   Agent Group Chain (AGC)                    ║');
  console.log('  ║   Multi-Agent Collaboration System           ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log('  ║   Open: http://localhost:3001                 ║');
  console.log('  ║   API:  http://localhost:3001/api             ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
}
bootstrap();
