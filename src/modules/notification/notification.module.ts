import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '@/modules/notification/domain/entities/notification.entity';
import { OutboxEvent } from '@/modules/notification/domain/entities/outbox-event.entity';
import { StaffNotification } from '@/modules/notification/domain/entities/staff-notification.entity';
import { DeviceToken } from '@/modules/notification/domain/entities/device-token.entity';
import { OwnerNotification } from '@/modules/notification/domain/entities/owner-notification.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { OwnerNotificationsService } from '@/modules/notification/application/owner-notifications.service';
import { OwnerNotificationsController } from '@/modules/notification/presentation/owner-notifications.controller';
import { NotificationsService } from '@/modules/notification/application/notifications.service';
import { OutboxService } from '@/modules/notification/application/outbox.service';
import { StaffNotificationsService } from '@/modules/notification/application/staff-notifications.service';
import { PushNotificationsService } from '@/modules/notification/application/push-notifications.service';
import { PushSenderPort } from '@/modules/notification/application/ports/push-sender.port';
import { NOTIFICATION_DISPATCHER } from '@/modules/notification/application/ports/notification.port';
import { NotificationsController } from '@/modules/notification/presentation/notifications.controller';
import { StaffNotificationsController } from '@/modules/notification/presentation/staff-notifications.controller';
import { DevicesController } from '@/modules/notification/presentation/devices.controller';
import { NotificationProviderRegistry } from '@/modules/notification/infrastructure/providers/notification-provider.registry';
import { EmailNotificationProvider } from '@/modules/notification/infrastructure/providers/email-notification.provider';
import { LogNotificationProvider } from '@/modules/notification/infrastructure/providers/log-notification.provider';
import { SmsNotificationProvider } from '@/modules/notification/infrastructure/providers/sms-notification.provider';
import { ZaloNotificationProvider } from '@/modules/notification/infrastructure/providers/zalo-notification.provider';
import { PushNotificationProvider } from '@/modules/notification/infrastructure/providers/push-notification.provider';
import { ExpoPushSender } from '@/modules/notification/infrastructure/push/expo-push.sender';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      OutboxEvent,
      StaffNotification,
      DeviceToken,
      OwnerNotification,
      User,
    ]),
  ],
  controllers: [
    NotificationsController,
    StaffNotificationsController,
    DevicesController,
    OwnerNotificationsController,
  ],
  providers: [
    NotificationsService,
    OutboxService,
    StaffNotificationsService,
    NotificationProviderRegistry,
    LogNotificationProvider,
    SmsNotificationProvider,
    ZaloNotificationProvider,
    EmailNotificationProvider,
    PushNotificationsService,
    OwnerNotificationsService,
    PushNotificationProvider,
    { provide: PushSenderPort, useClass: ExpoPushSender },

    { provide: NOTIFICATION_DISPATCHER, useExisting: NotificationProviderRegistry },
  ],
  exports: [
    NotificationsService,
    OutboxService,
    StaffNotificationsService,
    PushNotificationsService,
    OwnerNotificationsService,
  ],
})
export class NotificationModule {}
