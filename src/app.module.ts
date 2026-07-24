import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import jwtConfig from './config/jwt.config';
import aiServiceConfig from './config/ai-service.config';
import notificationConfig from './config/notification.config';
import filesConfig from './config/files.config';
import throttleConfig from './config/throttle.config';
import { validateEnv } from './config/env.validation';

import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BranchesModule } from './branches/branches.module';
import { PetsModule } from './pets/pets.module';
import { CatalogModule } from './catalog/catalog.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PrescreeningModule } from './prescreening/prescreening.module';
import { ExaminationsModule } from './examinations/examinations.module';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        aiServiceConfig,
        notificationConfig,
        filesConfig,
        throttleConfig,
      ],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttlSeconds')! * 1000,
            limit: config.get<number>('throttle.limit')!,
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,

    AuthModule,
    UsersModule,
    BranchesModule,
    PetsModule,
    CatalogModule,
    AppointmentsModule,
    PrescreeningModule,
    ExaminationsModule,
    BillingModule,
    NotificationsModule,
    ReportsModule,
    FilesModule,
  ],
  providers: [
    // ThrottlerGuard is deliberately NOT global here - Section 5 only asks to rate-limit
    // the public/unauthenticated endpoints (booking, login/register, file upload, AI
    // chat), not the whole authenticated staff dashboard. Those controllers apply
    // `@UseGuards(ThrottlerGuard)` + `@Throttle(...)` themselves.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
