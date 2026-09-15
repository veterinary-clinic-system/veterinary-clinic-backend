import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

const logger = new Logger('RedisClient');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const commonOptions: RedisOptions = {
          keyPrefix: config.get<string>('redis.keyPrefix'),
          lazyConnect: false,
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => Math.min(times * 500, 5000),
        };
        const url = config.get<string>('redis.url');
        const client = url
          ? new Redis(url, commonOptions)
          : new Redis({
              ...commonOptions,
              host: config.get<string>('redis.host'),
              port: config.get<number>('redis.port'),
              password: config.get<string>('redis.password'),
            });

        client.on('error', (error) => logger.warn(`Redis connection issue: ${error.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
