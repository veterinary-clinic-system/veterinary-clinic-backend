
export const AUDIT_RECORDER = Symbol('AUDIT_RECORDER');

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
  
  record(params: AuditRecordParams): void;
}
