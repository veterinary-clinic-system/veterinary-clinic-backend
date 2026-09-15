import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@/common/enums/notification.enum';
import { NotificationProvider } from './notification-provider.interface';
import { LogNotificationProvider } from './log-notification.provider';
import { SmsNotificationProvider } from './sms-notification.provider';
import { ZaloNotificationProvider } from './zalo-notification.provider';

/**
 * Resolves a channel to its provider. `NOTIFICATION_PROVIDER=log` (the default) routes
 * every channel through the console/DB logger regardless of which channel was
 * requested, which is what makes local dev safe-by-default per Section 5.3.
 */
@Injectable()
export class NotificationProviderRegistry {
  constructor(
    private readonly configService: ConfigService,
    private readonly logProvider: LogNotificationProvider,
    private readonly smsProvider: SmsNotificationProvider,
    private readonly zaloProvider: ZaloNotificationProvider,
  ) {}

  resolve(channel: NotificationChannel): NotificationProvider {
    const mode = this.configService.get<string>('notification.provider');

    if (mode === 'log' || !mode) {
      return this.logProvider;
    }

    return channel === NotificationChannel.ZALO ? this.zaloProvider : this.smsProvider;
  }
}
