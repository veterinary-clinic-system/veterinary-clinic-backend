import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import appConfig from './shared/config/app.config';
import databaseConfig from './shared/config/database.config';
import redisConfig from './shared/config/redis.config';
import jwtConfig from './shared/config/jwt.config';
import aiServiceConfig from './shared/config/ai-service.config';
import notificationConfig from './shared/config/notification.config';
import filesConfig from './shared/config/files.config';
import paymentConfig from './shared/config/payment.config';
import throttleConfig from './shared/config/throttle.config';
import { validateEnv } from './shared/config/env.validation';

import { DatabaseModule } from './shared/database/database.module';
import { RedisModule } from './shared/redis/redis.module';
import { AllExceptionsFilter } from './shared/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './shared/common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './shared/common/guards/jwt-auth.guard';
import { RolesGuard } from './shared/common/guards/roles.guard';

// Mot dong cho moi bounded context (Phan III tai lieu kien truc). App module chi biet
// den module goc cua tung context, khong biet den service/controller ben trong chung.
import { IdentityModule } from '@/modules/identity/identity.module';
import { OrganizationModule } from '@/modules/organization/organization.module';
import { PetsModule } from '@/modules/pets/pets.module';
import { CatalogModule } from '@/modules/catalog/catalog.module';
import { SchedulingModule } from '@/modules/scheduling/scheduling.module';
import { TriageModule } from '@/modules/triage/triage.module';
import { ClinicalModule } from '@/modules/clinical/clinical.module';
import { BillingModule } from '@/modules/billing/billing.module';
import { SalesModule } from '@/modules/sales/sales.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { ReportingModule } from '@/modules/reporting/reporting.module';
import { StorageModule } from '@/shared/storage/storage.module';

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
        paymentConfig,
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

    IdentityModule,
    OrganizationModule,
    PetsModule,
    CatalogModule,
    SchedulingModule,
    TriageModule,
    ClinicalModule,
    BillingModule,
    SalesModule,
    NotificationModule,
    ReportingModule,
    StorageModule,
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
