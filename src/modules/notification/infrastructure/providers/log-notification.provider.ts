import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationMessage,
  NotificationProvider,
  NotificationSendResult,
} from '@/modules/notification/application/ports/notification.port';

@Injectable()
export class LogNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger('NotificationProvider:log');

  async send(message: NotificationMessage): Promise<NotificationSendResult> {
    this.logger.log(
      `--> [${message.channel ?? '?'}] ` +
        `${message.channel === 'EMAIL' ? message.recipientEmail : message.recipientPhone}` +
        ` | ${message.subject ?? '(không tiêu đề)'} | ${message.message}`,
    );
    return { success: true, providerMessageId: `log-${Date.now()}` };
  }
}
