import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@/shared/common/enums/notification.enum';
import { NotificationProvider } from '@/modules/notification/application/ports/notification.port';
import { EmailNotificationProvider } from './email-notification.provider';
import { LogNotificationProvider } from './log-notification.provider';
import { PushNotificationProvider } from './push-notification.provider';
import { SmsNotificationProvider } from './sms-notification.provider';
import { ZaloNotificationProvider } from './zalo-notification.provider';

/**
 * `NOTIFICATION_PROVIDER=log` (mặc định ở dev): MỌI kênh chỉ ghi log, không gọi nhà cung
 * cấp thật - để chạy thử không làm phiền số điện thoại/hộp thư thật của ai.
 *
 * Mọi giá trị khác: mỗi kênh đi qua nhà cung cấp của chính nó. Kênh nào thiếu cấu hình
 * (chưa có token Zalo, chưa có SMTP) thì nhà cung cấp đó trả `success: false` kèm lý do,
 * và dòng `notifications` nằm ở FAILED. KHÔNG lặng lẽ rơi về log: rơi về log thì dòng
 * thông báo được đánh dấu SENT trong khi khách không nhận được gì - sai cấu hình bị che
 * mất cho tới khi khách phàn nàn.
 */
@Injectable()
export class NotificationProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(NotificationProviderRegistry.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly logProvider: LogNotificationProvider,
    private readonly smsProvider: SmsNotificationProvider,
    private readonly zaloProvider: ZaloNotificationProvider,
    private readonly emailProvider: EmailNotificationProvider,
    private readonly pushProvider: PushNotificationProvider,
  ) {}

  isSimulated(): boolean {
    const mode = this.configService.get<string>('notification.provider');
    return mode === 'log' || !mode;
  }

  /** Thiếu cấu hình Zalo thì kênh này bị bỏ qua - báo một lần ở đây để vận hành vẫn thấy. */
  onModuleInit(): void {
    if (!this.isConfigured(NotificationChannel.ZALO)) {
      this.logger.warn(
        'Zalo ZNS chưa cấu hình (ZALO_OA_ACCESS_TOKEN / ZALO_ZNS_TEMPLATE_ID) - ' +
          'thông báo cho khách chỉ gửi qua Gmail và push.',
      );
    }
  }

  isConfigured(channel: NotificationChannel): boolean {
    if (this.isSimulated()) return true;
    if (channel === NotificationChannel.ZALO) {
      return (
        !!this.configService.get<string>('notification.zalo.oaAccessToken') &&
        !!this.configService.get<string>('notification.zalo.znsTemplateId')
      );
    }
    return true;
  }

  resolve(channel: NotificationChannel): NotificationProvider {
    if (this.isSimulated()) {
      return this.logProvider;
    }

    switch (channel) {
      case NotificationChannel.ZALO:
        return this.zaloProvider;
      case NotificationChannel.EMAIL:
        return this.emailProvider;
      case NotificationChannel.PUSH:
        return this.pushProvider;
      case NotificationChannel.SMS:
      default:
        return this.smsProvider;
    }
  }
}
