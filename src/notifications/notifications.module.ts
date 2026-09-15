import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '@/database/entities';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationProviderRegistry } from './providers/notification-provider.registry';
import { LogNotificationProvider } from './providers/log-notification.provider';
import { SmsNotificationProvider } from './providers/sms-notification.provider';
import { ZaloNotificationProvider } from './providers/zalo-notification.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationProviderRegistry,
    LogNotificationProvider,
    SmsNotificationProvider,
    ZaloNotificationProvider,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
