import { Role } from '@/shared/common/enums/role.enum';

export enum StaffNotificationType {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  VACCINATION_DUE = 'VACCINATION_DUE',
}

export const STAFF_NOTIFICATION_RECIPIENTS: Record<StaffNotificationType, Role[]> = {
  [StaffNotificationType.LOW_STOCK]: [Role.ADMIN, Role.MANAGER, Role.PHARMACIST],
  [StaffNotificationType.OUT_OF_STOCK]: [Role.ADMIN, Role.MANAGER, Role.PHARMACIST],
  [StaffNotificationType.EXPIRING_SOON]: [Role.ADMIN, Role.MANAGER, Role.PHARMACIST],
  [StaffNotificationType.EXPIRED]: [Role.ADMIN, Role.MANAGER, Role.PHARMACIST],
  [StaffNotificationType.PAYMENT_FAILED]: [Role.ADMIN, Role.MANAGER, Role.RECEPTIONIST],
  [StaffNotificationType.PAYMENT_RECEIVED]: [Role.ADMIN, Role.MANAGER, Role.RECEPTIONIST],

  [StaffNotificationType.APPOINTMENT_CANCELLED]: [Role.ADMIN, Role.MANAGER, Role.RECEPTIONIST],
  [StaffNotificationType.VACCINATION_DUE]: [Role.ADMIN, Role.MANAGER, Role.RECEPTIONIST],
};
