export enum NotificationChannel {
  SMS = 'SMS',
  ZALO = 'ZALO',

  EMAIL = 'EMAIL',

  /** Expo push tới app chủ nuôi (P12) - chỉ khi chủ nuôi có ít nhất một máy đã đăng ký. */
  PUSH = 'PUSH',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum NotificationType {
  APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED',
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  APPOINTMENT_UPDATED = 'APPOINTMENT_UPDATED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
}
