import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationMessage,
  NotificationProvider,
  NotificationSendResult,
} from './notification-provider.interface';

const ZALO_OA_SEND_MESSAGE_URL = 'https://openapi.zalo.me/v3.0/oa/message/cs';

/**
 * Zalo Official Account "Consulting/Support" message API. Requires the recipient to
 * already be a Zalo user who follows/has interacted with the clinic's OA (a Zalo OA
 * platform constraint, not something this service can work around) and a valid
 * long-lived `ZALO_OA_ACCESS_TOKEN`. Without one, fails closed like SmsNotificationProvider.
 */
@Injectable()
export class ZaloNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger('NotificationProvider:zalo');

  constructor(private readonly configService: ConfigService) {}

  async send(message: NotificationMessage): Promise<NotificationSendResult> {
    const accessToken = this.configService.get<string>('notification.zalo.oaAccessToken');

    if (!accessToken) {
      return { success: false, error: 'ZALO_OA_ACCESS_TOKEN is not configured' };
    }

    try {
      const response = await fetch(ZALO_OA_SEND_MESSAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: accessToken },
        body: JSON.stringify({
          recipient: { user_id: message.recipientPhone },
          message: { text: message.message },
        }),
      });

      const body = (await response.json()) as { error?: number; message?: string };
      if (!response.ok || body.error) {
        return { success: false, error: body.message ?? `Zalo OA API error ${response.status}` };
      }

      return { success: true, providerMessageId: undefined };
    } catch (error) {
      this.logger.error(`Zalo send failed: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  }
}
