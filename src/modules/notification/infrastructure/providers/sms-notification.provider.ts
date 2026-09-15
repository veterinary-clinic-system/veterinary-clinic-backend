import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationMessage,
  NotificationProvider,
  NotificationSendResult,
} from '@/modules/notification/application/ports/notification.port';

@Injectable()
export class SmsNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger('NotificationProvider:sms');

  constructor(private readonly configService: ConfigService) {}

  async send(message: NotificationMessage): Promise<NotificationSendResult> {
    const apiUrl = this.configService.get<string>('notification.sms.apiUrl');
    const apiKey = this.configService.get<string>('notification.sms.apiKey');
    const senderId = this.configService.get<string>('notification.sms.senderId');

    if (!apiUrl || !apiKey) {
      return { success: false, error: 'SMS_API_URL/SMS_API_KEY are not configured' };
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          to: message.recipientPhone,
          sender: senderId,
          message: message.message,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        return { success: false, error: `SMS gateway responded ${response.status}: ${body}` };
      }

      const body = (await response.json()) as { messageId?: string };
      return { success: true, providerMessageId: body.messageId };
    } catch (error) {
      this.logger.error(`SMS send failed: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  }
}
