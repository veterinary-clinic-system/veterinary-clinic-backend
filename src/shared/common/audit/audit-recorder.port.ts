/**
 * Cua duy nhat de tang `shared` ghi nhat ky kiem toan - P10-T1.
 *
 * VI SAO PHAI CO PORT NAY. `AuditInterceptor` nam o `shared/common/interceptors` (no la
 * ha tang dung chung, gan duoc len bat ky handler nao), nhung bang `audit_logs` va
 * `AuditLogService` lai thuoc bounded context `identity`. Luat kien truc cua du an -
 * ESLint `import/no-restricted-paths` chan cung - cam `shared/` biet den bat ky module
 * nghiep vu nao.
 *
 * Nen interceptor phu thuoc vao INTERFACE nay, con `identity` dang ky adapter that o
 * composition root cua no (`audit-log.module.ts`). Cung mau da dung cho
 * `NOTIFICATION_DISPATCHER`, va cung ly do: chieu phu thuoc luon tro vao trong.
 */
export const AUDIT_RECORDER = Symbol('AUDIT_RECORDER');

/** Mot dong nhat ky sap duoc ghi. `changes` PHAI da qua `sanitizeAuditPayload`. */
export interface AuditRecordParams {
  actorUserId: string | null;
  action: string;
  entityName: string;
  entityId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditRecorder {
  /**
   * Ghi mot dong nhat ky. KHONG DUOC NEM LOI va khong duoc bat nguoi goi `await` -
   * audit khong bao gio duoc lam hong hay lam cham nghiep vu (P10-T1).
   */
  record(params: AuditRecordParams): void;
}
