import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

const logger = new Logger('RedisClient');

/**
 * Global so any module can `@Inject(REDIS_CLIENT)` without re-importing this module
 * everywhere (Section 3: "Redis is used by the backend for... caching doctor
 * availability lookups"). Currently the only consumer is
 * AvailabilityService (see appointments/scheduling/availability.service.ts).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis({
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
          // Don't crash app startup if Redis is briefly unreachable - caching is a
          // pure performance optimization here, never a correctness dependency
          // (bookings are still validated against Postgres directly).
          lazyConnect: false,
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => Math.min(times * 500, 5000),
        });
        // ioredis emits 'error' on every failed connection attempt; an EventEmitter
        // with no 'error' listener crashes the Node process on the first one, so this
        // listener is required, not optional, even though it just logs.
        client.on('error', (error) => logger.warn(`Redis connection issue: ${error.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
