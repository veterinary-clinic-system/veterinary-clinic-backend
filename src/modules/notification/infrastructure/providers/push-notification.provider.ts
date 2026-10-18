import { Injectable } from '@nestjs/common';
import {
  NotificationMessage,
  NotificationProvider,
  NotificationSendResult,
} from '@/modules/notification/application/ports/notification.port';
import { PushNotificationsService } from '@/modules/notification/application/push-notifications.service';

/** Kênh PUSH của NotificationProviderRegistry: gửi tới mọi máy của số điện thoại nhận. */
@Injectable()
export class PushNotificationProvider implements NotificationProvider {
  constructor(private readonly push: PushNotificationsService) {}

  send(message: NotificationMessage): Promise<NotificationSendResult> {
    return this.push.sendToPhone(message.recipientPhone, {
      title: message.subject ?? 'VetCare',
      body: message.message,
      url: message.url,
    });
  }
}
