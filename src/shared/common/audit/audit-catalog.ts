import { AuditAction } from '@/shared/common/enums/audit-action.enum';

export const AUDIT_ACTIONS: string[] = Object.values(AuditAction);

export const AUDIT_ENTITIES: string[] = [
  'User',
  'Pet',
  'Appointment',
  'MedicalRecord',
  'Prescription',
  'Vaccination',
  'LabTestOrder',
  'Invoice',
  'Payment',
  'InventoryItem',
  'StockTake',
  'RolePermission',
];
