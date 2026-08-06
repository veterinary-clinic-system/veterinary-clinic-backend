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

/** Tran thoi gian cho moi phep kiem tra phu tro - NFR-03. */
const PROBE_TIMEOUT_MS = 3000;

/**
 * `GET /health` - NFR-03 (P10-T7).
 *
 * `@Public()` vi day la endpoint cua HA TANG, khong phai cua nguoi dung: Docker
 * healthcheck, bo can bang tai va cac cong cu giam sat deu goi no truoc khi bat ky ai
 * dang nhap, va khong cai nao trong so do cam duoc mot token.
 *
 * VI CONG KHAI NEN KHONG LO CHI TIET. Phan hoi chi noi tung thanh phan `up` hay `down`.
 * Khong bao gio co chuoi ket noi, ten host noi bo, phien ban PostgreSQL hay noi dung
 * loi tho - do la ban do ha tang mien phi cho nguoi do tim duong vao. Thong tin chan
 * doan that su nam trong log ung dung, noi da co xac thuc bao ve.
 *
 * POSTGRES LA THANH PHAN DUY NHAT LAM SAP 503. Redis, MinIO va dich vu AI deu la phu
 * tro: mat Redis thi dashboard cham di nhung van dung; mat MinIO thi khong tai anh len
 * duoc nhung van kham va thanh toan duoc; mat dich vu AI thi mat phan phan loai uu tien.
 * Bao 503 cho nhung truong hop do se khien bo can bang tai rut mot may chu VAN DANG
 * PHUC VU DUOC ra khoi vong - chua ke mot dot AI cham co the keo sap ca he thong.
 * Mat PostgreSQL thi khong con gi de phuc vu, va do moi la dinh nghia cua "chet".
 */
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

  /**
   * CHI POSTGRES nam trong danh sach cua terminus, va do la diem quan trong nhat o day.
   *
   * Terminus danh ca lan kiem tra la that bai (503) neu BAT KY indicator nao bao `down`
   * - khong co khai niem "hong mot phan". Nen de ba thanh phan phu tro vao danh sach ay
   * se bien "dich vu AI dang khoi dong lai" thanh "may chu nay da chet", va bo can bang
   * tai se rut mot may van dang kham va thu tien binh thuong ra khoi vong.
   *
   * Vi vay chung duoc do RIENG roi ghep vao phan hoi: nguoi van hanh van thay day du
   * trang thai tung thanh phan, nhung chi Postgres moi quyet dinh ma HTTP.
   */
  @Public()
  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    const auxiliary = await this.probeAuxiliary();

    // Nem `ServiceUnavailableException` (503) khi Postgres chet - dung hanh vi mong doi.
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

  // ------------------------------------------------------------------ Ben trong

  /**
   * Bien mot phep do thanh mot ket qua khong bao gio that bai.
   *
   * Ly do khong ghi thong diep loi vao ket qua: `status: 'down'` da du de nguoi van
   * hanh biet phai di xem cai gi, con ly do cu the thi nam trong log - noi khong cong
   * khai. Xem ghi chu dau lop.
   */
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

  /**
   * MinIO khong co endpoint `/health` theo chuan S3 - no phoi
   * `/minio/health/live`, mot endpoint khong can xac thuc va tra 200 khi tien trinh
   * con song. Dung no chu khong goi `ListBuckets`: `ListBuckets` doi thong tin dang
   * nhap va se bao "chet" khi that ra chi la khoa bi sai.
   */
  private minioHealthUrl(): string | null {
    const endpoint = this.configService.get<string>('files.s3.endpoint');
    return endpoint ? `${endpoint.replace(/\/$/, '')}/minio/health/live` : null;
  }

  private aiHealthUrl(): string | null {
    const baseUrl = this.configService.get<string>('aiService.baseUrl');
    return baseUrl ? `${baseUrl.replace(/\/$/, '')}/health` : null;
  }

  /** `ioredis` khong nhan tham so tran thoi gian cho mot lenh don le. */
  private withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} qua ${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS),
      ),
    ]);
  }
}
