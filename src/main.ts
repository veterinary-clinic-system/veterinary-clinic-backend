import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.enableCors({ origin: config.get<string>('app.corsOrigin'), credentials: true });

  // Uploaded pet/symptom/exam files (local-disk volume, Section 2) served as static assets.
  app.useStaticAssets(join(process.cwd(), config.get<string>('files.storageRoot')!), {
    prefix: '/uploads',
  });

  app.setGlobalPrefix(config.get<string>('app.apiPrefix')!);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // NOT forbidNonWhitelisted: several list endpoints bind `@Query() pagination:
      // PaginationQueryDto` alongside separate `@Query('branchId')`-style params in the
      // same handler (see AppointmentsController.listForStaff, UsersController.findAll).
      // Nest's ValidationPipe validates that DTO binding against the *entire* raw query
      // string, so with forbidNonWhitelisted on, any real filter param (branchId, role,
      // status, ...) would be rejected as "should not exist" on PaginationQueryDto.
      // `whitelist: true` alone still strips unknown properties from the DTO instance
      // (so it can't be used to smuggle unexpected fields into a service), it just
      // doesn't hard-fail the request over it.
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('veterinary-clinic-backend')
    .setDescription('Multi-branch veterinary clinic management API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('app.port')!;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`veterinary-clinic-backend listening on http://localhost:${port}/${config.get('app.apiPrefix')}`);
}

bootstrap();
