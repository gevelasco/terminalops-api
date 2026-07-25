import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
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

  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: JSON_BODY_LIMIT, extended: true });

  const origin = configService.get<string>('ORIGIN') ?? 'http://localhost:4200';
  app.enableCors({
    origin,
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

  const swagger = new DocumentBuilder()
    .setTitle('TerminalOps API')
    .setDescription('API local para logística TerminalOps (multi-tenant por empresa)')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api', app, document);

  const port = configService.get<number>('PORT') ?? 4000;
  await app.listen(port);
  console.log(`TerminalOps API listening on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api`);
}

bootstrap();
