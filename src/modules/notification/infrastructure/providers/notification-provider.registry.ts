import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@/shared/common/enums/notification.enum';
import { NotificationProvider } from '@/modules/notification/application/ports/notification.port';
import { EmailNotificationProvider } from './email-notification.provider';
import { LogNotificationProvider } from './log-notification.provider';
import { SmsNotificationProvider } from './sms-notification.provider';
import { ZaloNotificationProvider } from './zalo-notification.provider';

@Injectable()
export class NotificationProviderRegistry {
  private readonly logger = new Logger(NotificationProviderRegistry.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly logProvider: LogNotificationProvider,
    private readonly smsProvider: SmsNotificationProvider,
    private readonly zaloProvider: ZaloNotificationProvider,
    private readonly emailProvider: EmailNotificationProvider,
  ) {}

  resolve(channel: NotificationChannel): NotificationProvider {
    const mode = this.configService.get<string>('notification.provider');

    if (mode === 'log' || !mode) {
      return this.logProvider;
    }

    switch (channel) {
      case NotificationChannel.ZALO:
        return this.zaloProvider;
      case NotificationChannel.EMAIL:
        return this.resolveEmail();
      case NotificationChannel.SMS:
      default:
        return this.smsProvider;
    }
  }

  private resolveEmail(): NotificationProvider {
    if (this.configService.get<string>('notification.email.host')) {
      return this.emailProvider;
    }

    this.logger.warn('SMTP_HOST chưa cấu hình - thông báo email sẽ chỉ được ghi log.');
    return this.logProvider;
  }
}
