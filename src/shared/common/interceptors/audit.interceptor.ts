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

    const origin: RequestOrigin = {
      ipAddress: resolveClientIp(request),
      userAgent: request.headers['user-agent'] ?? null,
    };
    const before = await this.snapshot(options, entityId);

    return next.handle().pipe(
      tap({
        next: (result) => {
          
          const finalId = entityId ?? this.idFromResult(result);
          const action = options.resolveAction?.(request.body) ?? options.action;
          void this.write(options, action, request, actor, origin, finalId, before, result);
        },
      }),
    );
  }

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
      
      this.logger.error(`Khong dung duoc noi dung nhat ky kiem toan: ${(error as Error).message}`);
    }
  }

  private buildChanges(
    options: AuditOptions,
    request: Request,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    result: unknown,
  ): Record<string, unknown> | null {
    if (before || after) {
      const diff = diffAuditSnapshots(before, after);

      return { before, after, diff };
    }

    const body = request.body as unknown;
    const payload = body && Object.keys(body as object).length > 0 ? body : result;
    const sanitized = sanitizeAuditPayload(payload);
    return sanitized && typeof sanitized === 'object'
      ? { request: sanitized as Record<string, unknown> }
      : null;
  }

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

  private idFromResult(result: unknown): string | null {
    if (!result || typeof result !== 'object') {
      return null;
    }
    const record = result as Record<string, unknown>;
    if (typeof record.id === 'string') {
      return record.id;
    }
    
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
