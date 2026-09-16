import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { formatValidationErrors } from './shared/common/validation/validation-error.formatter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.enableCors({ origin: config.get<string>('app.corsOrigin'), credentials: true });

  app.setGlobalPrefix(config.get<string>('app.apiPrefix')!);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      transform: true,
      transformOptions: { enableImplicitConversion: true },

      exceptionFactory: formatValidationErrors,
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
  await app.listen(port, '0.0.0.0');

  console.log(
    `veterinary-clinic-backend listening on http://0.0.0.0:${port}/${config.get('app.apiPrefix')}`,
  );
}

bootstrap();
