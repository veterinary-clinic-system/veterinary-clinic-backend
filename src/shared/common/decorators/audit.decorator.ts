import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../enums/audit-action.enum';

export const AUDIT_KEY = 'audit';

export type AuditActionResolver = (body: unknown) => AuditAction | undefined;

export interface AuditOptions {
  
  action: AuditAction;
  
  resolveAction?: AuditActionResolver;
  
  entity: string;
  
  idParam?: string;
  
  snapshot?: boolean;
}

export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);
