import { registerAs } from '@nestjs/config';

export default registerAs('notification', () => ({
  provider: process.env.NOTIFICATION_PROVIDER ?? 'log',
  sms: {
    apiUrl: process.env.SMS_API_URL,
    apiKey: process.env.SMS_API_KEY,
    apiSecret: process.env.SMS_API_SECRET,
    senderId: process.env.SMS_SENDER_ID ?? 'VetClinic',
  },
  zalo: {
    oaAccessToken: process.env.ZALO_OA_ACCESS_TOKEN,
    oaId: process.env.ZALO_OA_ID,
  },
  /**
   * Kenh EMAIL - P10-T6. `SMTP_HOST` la cong tac bat/tat: bo trong thi
   * `NotificationProviderRegistry` khong bao gio chon kenh nay, khong can sua mot dong
   * ma nao (acceptance P10-T6).
   */
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'Phòng khám thú y <no-reply@vetclinic.local>',
  },
  reminderLeadHours: parseInt(process.env.APPOINTMENT_REMINDER_LEAD_HOURS ?? '24', 10),
}));
