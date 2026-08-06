import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/**
 * Kiem tra suc khoe he thong - NFR-03 (P10-T7).
 *
 * `RedisModule` la `@Global()` nen `REDIS_CLIENT` tiem duoc ma khong phai import lai.
 */
@Module({
  imports: [TerminusModule, ConfigModule],
  controllers: [HealthController],
})
export class HealthModule {}
