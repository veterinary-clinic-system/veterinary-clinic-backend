import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationMessage,
  NotificationProvider,
  NotificationSendResult,
} from './notification-provider.interface';

/**
 * Default provider for local/dev (Section 5.3: "a logging/mock implementation that
 * writes to console or a local table is acceptable"). NotificationsService already
 * persists every attempt to the `notifications` table regardless of provider, so this
 * one only needs to write to the console and always "succeed".
 */
@Injectable()
export class LogNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger('NotificationProvider:log');

  async send(message: NotificationMessage): Promise<NotificationSendResult> {
    this.logger.log(`--> ${message.recipientPhone}: ${message.message}`);
    return { success: true, providerMessageId: `log-${Date.now()}` };
  }
}
