import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

// Force-load .env values, overriding empty system env vars.
// dotenv (used by @nestjs/config) does not override existing vars by default.
(function loadEnvOverride() {
  const candidates = [
    join(__dirname, '..', '..', '.env'),
    join(__dirname, '..', '.env'),
    '.env',
  ];
  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.*?)["']?\s*$/);
        if (match) {
          const [, key, value] = match;
          if (!process.env[key] || process.env[key] === '') {
            process.env[key] = value;
          }
        }
      }
      break;
    }
  }
})();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.use(cookieParser());

  // CORS — strict in production, permissive in development.
  // WEB_URL must be set in production or the API fails fast at boot.
  const isProd = process.env.NODE_ENV === 'production';
  const allowAll = process.env.CORS_ALLOW_ALL === 'true';

  if (isProd && !process.env.WEB_URL && !allowAll) {
    throw new Error(
      'WEB_URL is required in production. Set it to your web app origin (e.g. https://app.example.com), ' +
      'or set CORS_ALLOW_ALL=true to opt in to permissive CORS.',
    );
  }

  const allowedOrigins = [
    process.env.WEB_URL,
    ...(isProd ? [] : ['http://localhost:3000']),
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server).
      if (!origin) return callback(null, true);
      if (allowAll) return callback(null, true);
      if (allowedOrigins.some((o) => origin.startsWith(o))) {
        return callback(null, true);
      }
      // Reject everything else (no silent allow-all fallback).
      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('DBM Construction Portal API')
    .setDescription('Phase 1 — Foundation + AI Scope Architect')
    .setVersion('0.1.0')
    .addCookieAuth('session')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || process.env.API_PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🏗️  DBM API running on http://localhost:${port}`);
  console.log(`📄 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
