/** Channels implemented by the NotificationProvider abstraction (Section 5.3). */
export enum NotificationChannel {
  SMS = 'SMS',
  ZALO = 'ZALO',
  /** Thu dien tu - P10-T6. Bat/tat bang bien moi truong, xem `notification.config.ts`. */
  EMAIL = 'EMAIL',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum NotificationType {
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  APPOINTMENT_UPDATED = 'APPOINTMENT_UPDATED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
}
