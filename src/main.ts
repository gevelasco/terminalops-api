import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import {
  assertProductionEnv,
  parseCorsOrigins,
} from './common/config/env.validation';
import { AllExceptionsFilter } from './common/observability/all-exceptions.filter';
import { RequestLoggingInterceptor } from './common/observability/request-logging.interceptor';
import { requestIdMiddleware } from './common/observability/request-id.middleware';
import { assertRequiredTypeOrmEntities } from './database/assert-typeorm-entities';
import EnvConfig from './types/env-config.type';

/** Avatares van como data URL en JSON (perfil/login); el default de Express (~100kb) los rechaza. */
const JSON_BODY_LIMIT = '5mb';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Evita el parser default (~100kb) para poder subir fotos de perfil en JSON.
    bodyParser: false,
  });
  assertRequiredTypeOrmEntities(app);
  const configService = app.get(ConfigService<EnvConfig>);

  assertProductionEnv({
    NODE_ENV: configService.get('NODE_ENV', { infer: true }),
    ORIGIN: configService.get('ORIGIN', { infer: true }),
    JWT_SECRET: configService.get('JWT_SECRET', { infer: true }),
    JWT_REFRESH_SECRET: configService.get('JWT_REFRESH_SECRET', { infer: true }),
    DB_HOST: configService.get('DB_HOST', { infer: true }),
    DB_USERNAME: configService.get('DB_USERNAME', { infer: true }),
    DB_PASSWORD: configService.get('DB_PASSWORD', { infer: true }),
    DB_DATABASE: configService.get('DB_DATABASE', { infer: true }),
    DB_SSL: configService.get('DB_SSL', { infer: true }),
    ENABLE_SWAGGER: configService.get('ENABLE_SWAGGER', { infer: true }),
    ALERT_WEBHOOK_URL: configService.get('ALERT_WEBHOOK_URL', { infer: true }),
  });

  // Detrás de Railway/Nginx/Cloudflare: respeta X-Forwarded-* (rate limit + HTTPS).
  app.set('trust proxy', 1);
  app.use(
    helmet({
      // API JSON; CSP la aplica el FE / reverse proxy.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(requestIdMiddleware);

  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: JSON_BODY_LIMIT, extended: true });

  const origins = parseCorsOrigins(
    configService.get<string>('ORIGIN', { infer: true }),
  );
  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(app.get(AllExceptionsFilter));
  app.useGlobalInterceptors(app.get(RequestLoggingInterceptor));

  const nodeEnv = (
    configService.get<string>('NODE_ENV', { infer: true }) ?? ''
  ).toLowerCase();
  const enableSwagger =
    nodeEnv !== 'production' ||
    configService.get<string>('ENABLE_SWAGGER', { infer: true }) === 'true';

  if (enableSwagger) {
    const swagger = new DocumentBuilder()
      .setTitle('TerminalOps API')
      .setDescription(
        'API local para logística TerminalOps (multi-tenant por empresa)',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('api', app, document);
  }

  const port = configService.get<number>('PORT') ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`TerminalOps API listening on port ${port} (env=${nodeEnv || 'local'})`);
  if (enableSwagger) {
    // eslint-disable-next-line no-console
    console.log(`Swagger UI: /api`);
  }
}

bootstrap();
