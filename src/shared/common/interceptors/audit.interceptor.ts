import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_RECORDER, AuditRecorder } from '@/shared/common/audit/audit-recorder.port';
import { resolveClientIp } from '@/shared/common/audit/client-ip';
import { AUDIT_KEY, AuditOptions } from '@/shared/common/decorators/audit.decorator';
import { diffAuditSnapshots, sanitizeAuditPayload } from '@/shared/common/audit/audit-sanitizer';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';

/**
 * Ghi nhat ky kiem toan cho cac handler co `@Audit(...)` - SRS FR-26, BR-17 (P10-T1).
 *
 * CHUP TRUOC/SAU MOT CACH TONG QUAT. Decorator khai ten entity TypeORM, interceptor doc
 * chinh entity do qua `dataSource.getRepository(...)` truoc va sau khi handler chay, roi
 * chi ghi lai NHUNG TRUONG THUC SU DOI. Nho vay khong service nao phai biet den audit -
 * them mot dong `@Audit(...)` len handler la du, va khong co cho nao "quen truyen ban
 * chup cu" nhu cach lam bat service tu goi.
 *
 * Gia cua cach nay la hai truy van doc them cho moi lan ghi co audit. Chap nhan duoc:
 * cac endpoint duoc audit deu la thao tac nghiep vu don le (sua khach hang, thanh toan,
 * chinh kho), khong phai duong nong.
 *
 * CHI GHI KHI HANDLER THANH CONG. Mot request bi tu choi (403, 409, 400) khong lam doi
 * du lieu nao, nen no khong thuoc ve nhat ky THAY DOI. Lan vet dang nhap that bai la
 * viec cua log ung dung va cua `LOGIN` - khong phai cua bang nay.
 *
 * `passwordHash` KHONG BAO GIO xuat hien o day, va co hai lop chan doc lap: cot do khai
 * `select: false` tren entity `User` nen `find` khong lay len, va `sanitizeAuditPayload`
 * che moi truong khop mau `password` du no den tu dau. Xem `audit-sanitizer.spec.ts`.
 */
/** Nguon goc request, chup lai truoc khi handler chay - xem ghi chu trong `intercept`. */
interface RequestOrigin {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: AuditRecorder,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const options = this.reflector.get<AuditOptions | undefined>(AUDIT_KEY, context.getHandler());
    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const actor = request.user as AuthenticatedUser | undefined;
    const entityId = this.resolveEntityId(request, options);

    // CHUP IP NGAY BAY GIO, khong doi toi luc ghi. `request.ip` la mot getter doc
    // `socket.remoteAddress`, ma `write()` chay SAU khi response da tra xong - luc do
    // Express da nha socket va getter tra `undefined`. Trieu chung rat de bo qua: cot
    // `user_agent` (doc tu mot object thuong) van dung, chi rieng `ip_address` rong.
    const origin: RequestOrigin = {
      ipAddress: resolveClientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    };
    const before = await this.snapshot(options, entityId);

    return next.handle().pipe(
      tap({
        next: (result) => {
          // `entityId` cua mot lenh CREATE chi biet duoc SAU khi handler chay xong.
          const finalId = entityId ?? this.idFromResult(result);
          const action = options.resolveAction?.(request.body) ?? options.action;
          void this.write(options, action, request, actor, origin, finalId, before, result);
        },
      }),
    );
  }

  // ------------------------------------------------------------------ Ben trong

  private async write(
    options: AuditOptions,
    action: string,
    request: Request,
    actor: AuthenticatedUser | undefined,
    origin: RequestOrigin,
    entityId: string | null,
    before: Record<string, unknown> | null,
    result: unknown,
  ): Promise<void> {
    try {
      const after = await this.snapshot(options, entityId);
      this.auditRecorder.record({
        actorUserId: actor?.userId ?? null,
        action,
        entityName: options.entity,
        entityId,
        changes: this.buildChanges(options, request, before, after, result),
        ipAddress: origin.ipAddress,
        userAgent: origin.userAgent,
      });
    } catch (error) {
      // Cung ly do voi `AuditLogService.record`: audit hong khong duoc lam hong gi ca.
      this.logger.error(`Khong dung duoc noi dung nhat ky kiem toan: ${(error as Error).message}`);
    }
  }

  /**
   * Noi dung dong nhat ky.
   *
   * Co ban chup hai dau thi ghi BANG KHAC BIET - xem `diffAuditSnapshots`. Khong co (endpoint
   * khai `snapshot: false`, hoac ban ghi da bi xoa cung) thi rot ve body cua request da
   * loc: van tra loi duoc "ai da yeu cau gi", chi khong noi duoc gia tri cu.
   */
  private buildChanges(
    options: AuditOptions,
    request: Request,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    result: unknown,
  ): Record<string, unknown> | null {
    if (before || after) {
      const diff = diffAuditSnapshots(before, after);
      // Khong truong nao doi (vi du bam "luu" ma khong sua gi) van dang ghi lai: no
      // chung minh nguoi do co cham vao ban ghi, va do dung la cau hoi cua kiem toan.
      return { before, after, diff };
    }

    const body = request.body as unknown;
    const payload = body && Object.keys(body as object).length > 0 ? body : result;
    const sanitized = sanitizeAuditPayload(payload);
    return sanitized && typeof sanitized === 'object'
      ? { request: sanitized as Record<string, unknown> }
      : null;
  }

  /**
   * Doc mot ban ghi va che cac truong nhay cam.
   *
   * Nuot moi loi ve `null`: ten entity go sai, ban ghi da bi xoa cung, hay bang chua ton
   * tai deu khong duoc lam hong request nghiep vu. Khi do dong audit van duoc ghi, chi
   * la khong co ban chup - va `buildChanges` tu rot ve body cua request.
   */
  private async snapshot(
    options: AuditOptions,
    entityId: string | null,
  ): Promise<Record<string, unknown> | null> {
    if (options.snapshot === false || !entityId) {
      return null;
    }
    try {
      const repository = this.dataSource.getRepository(options.entity);
      const row = await repository.findOne({ where: { id: entityId } });
      if (!row) {
        return null;
      }
      return sanitizeAuditPayload(row) as Record<string, unknown>;
    } catch (error) {
      this.logger.warn(
        `Khong chup duoc trang thai cua ${options.entity}#${entityId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private resolveEntityId(request: Request, options: AuditOptions): string | null {
    const params = request.params as Record<string, string | undefined>;
    return params?.[options.idParam ?? 'id'] ?? null;
  }

  /** Ket qua tra ve cua mot lenh tao thuong la chinh ban ghi vua tao, hoac boc mot lop. */
  private idFromResult(result: unknown): string | null {
    if (!result || typeof result !== 'object') {
      return null;
    }
    const record = result as Record<string, unknown>;
    if (typeof record.id === 'string') {
      return record.id;
    }
    // Cac view boc ngoai cua du an: `{ prescription: {...} }`, `{ vaccination: {...} }`.
    for (const value of Object.values(record)) {
      if (
        value &&
        typeof value === 'object' &&
        typeof (value as { id?: unknown }).id === 'string'
      ) {
        return (value as { id: string }).id;
      }
    }
    return null;
  }
}
