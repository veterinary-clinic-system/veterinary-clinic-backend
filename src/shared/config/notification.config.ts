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
  reminderLeadHours: parseInt(process.env.APPOINTMENT_REMINDER_LEAD_HOURS ?? '24', 10),
}));
