import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@/shared/common/enums/notification.enum';
import { NotificationProvider } from '@/modules/notification/application/ports/notification.port';
import { EmailNotificationProvider } from './email-notification.provider';
import { LogNotificationProvider } from './log-notification.provider';
import { SmsNotificationProvider } from './sms-notification.provider';
import { ZaloNotificationProvider } from './zalo-notification.provider';

/**
 * Resolves a channel to its provider. `NOTIFICATION_PROVIDER=log` (the default) routes
 * every channel through the console/DB logger regardless of which channel was
 * requested, which is what makes local dev safe-by-default per Section 5.3.
 *
 * KENH EMAIL (P10-T6) BAT/TAT BANG BIEN MOI TRUONG, khong sua ma: khong co `SMTP_HOST`
 * thi mot yeu cau gui qua `EMAIL` roi ve `LogNotificationProvider`. Nho vay may dev cua
 * ai cung chay duoc ngay sau khi `git clone` - khong ai phai dung mot may chu SMTP chi
 * de mo trang chu len (acceptance P10-T6).
 *
 * Chu y cai roi ve nay CHI ap dung cho viec THIEU CAU HINH. Da cau hinh SMTP roi ma gui
 * loi thi `EmailNotificationProvider` bao that bai that su - va outbox se thu lai. Nuot
 * mot loi gui that thanh mot dong log se lam he thong bao "da gui" cho thu khong bao gio
 * den noi.
 */
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
