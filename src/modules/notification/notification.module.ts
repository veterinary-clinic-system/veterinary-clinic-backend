import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '@/modules/notification/domain/entities/notification.entity';
import { OutboxEvent } from '@/modules/notification/domain/entities/outbox-event.entity';
import { NotificationsService } from '@/modules/notification/application/notifications.service';
import { OutboxService } from '@/modules/notification/application/outbox.service';
import { NOTIFICATION_DISPATCHER } from '@/modules/notification/application/ports/notification.port';
import { NotificationsController } from '@/modules/notification/presentation/notifications.controller';
import { NotificationProviderRegistry } from '@/modules/notification/infrastructure/providers/notification-provider.registry';
import { LogNotificationProvider } from '@/modules/notification/infrastructure/providers/log-notification.provider';
import { SmsNotificationProvider } from '@/modules/notification/infrastructure/providers/sms-notification.provider';
import { ZaloNotificationProvider } from '@/modules/notification/infrastructure/providers/zalo-notification.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, OutboxEvent])],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    OutboxService,
    NotificationProviderRegistry,
    LogNotificationProvider,
    SmsNotificationProvider,
    ZaloNotificationProvider,
    // Noi port cua tang application voi adapter o tang infrastructure. Day la
    // composition root - cho duy nhat trong module duoc biet ca hai phia.
    { provide: NOTIFICATION_DISPATCHER, useExisting: NotificationProviderRegistry },
  ],
  exports: [NotificationsService, OutboxService],
})
export class NotificationModule {}
