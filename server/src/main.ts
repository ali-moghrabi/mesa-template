import {
  ConsoleLogger,
  Logger,
  ValidationPipe,
  VersioningType,
  type LogLevel,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

const isProd = process.env.NODE_ENV === 'production';

const trustProxy = Number(process.env.TRUST_PROXY ?? 0);

const parseOrigins = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });

  const logLevels: LogLevel[] = isProd
    ? ['fatal', 'error', 'warn', 'log']
    : ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];
  app.useLogger(
    new ConsoleLogger({ json: isProd, colors: !isProd, logLevels }),
  );

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const allowedOrigins = new Set(
    parseOrigins(config.get('CLIENT_ORIGIN', { infer: true })),
  );

  if (trustProxy > 0) app.set('trust proxy', trustProxy);

  app.use(helmet());
  app.use(compression({ threshold: 1024 }));

  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  app.enableCors({
    origin: (origin, callback) =>
      callback(null, !origin || allowedOrigins.has(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Retry-After'],
    credentials: true,
    optionsSuccessStatus: 204,
    maxAge: 86_400,
  });

  app.use(cookieParser(config.get('COOKIE_SECRET', { infer: true })));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true }) ?? 8000;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(
    `API ready on port ${port}${isProd ? '' : ' (development)'}`,
  );
}
void bootstrap();
