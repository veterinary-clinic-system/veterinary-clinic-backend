import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorResult,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/redis/redis.constants';
import { Public } from '@/shared/common/decorators/public.decorator';

const PROBE_TIMEOUT_MS = 3000;

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    const auxiliary = await this.probeAuxiliary();

    const result = await this.health.check([
      () => this.db.pingCheck('postgres', { timeout: PROBE_TIMEOUT_MS }),
    ]);

    return {
      ...result,
      info: { ...result.info, ...auxiliary },
      details: { ...result.details, ...auxiliary },
    };
  }

  private async probeAuxiliary(): Promise<HealthIndicatorResult> {
    const results = await Promise.all([
      this.softCheck('redis', () => this.pingRedis()),
      this.softCheck('minio', () => this.pingHttp(this.minioHealthUrl())),
      this.softCheck('ai-service', () => this.pingHttp(this.aiHealthUrl())),
    ]);

    return Object.assign({}, ...results) as HealthIndicatorResult;
  }

  private async softCheck(key: string, probe: () => Promise<void>): Promise<HealthIndicatorResult> {
    try {
      await probe();
      return { [key]: { status: 'up' } };
    } catch (error) {
      this.logger.warn(`Health check "${key}" that bai: ${(error as Error).message}`);
      return { [key]: { status: 'down' } };
    }
  }

  private async pingRedis(): Promise<void> {
    const reply = await this.withTimeout(this.redis.ping(), 'redis');
    if (reply !== 'PONG') {
      throw new Error(`Redis tra loi bat thuong: ${reply}`);
    }
  }

  private async pingHttp(url: string | null): Promise<void> {
    if (!url) {
      throw new Error('Chua cau hinh dia chi');
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  private minioHealthUrl(): string | null {
    const endpoint = this.configService.get<string>('files.s3.endpoint');
    return endpoint ? `${endpoint.replace(/\/$/, '')}/minio/health/live` : null;
  }

  private aiHealthUrl(): string | null {
    const baseUrl = this.configService.get<string>('aiService.baseUrl');
    return baseUrl ? `${baseUrl.replace(/\/$/, '')}/health` : null;
  }

  private withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} qua ${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS),
      ),
    ]);
  }
}
