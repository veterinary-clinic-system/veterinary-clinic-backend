import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DevicePlatform, DeviceToken } from '@/modules/notification/domain/entities/device-token.entity';
import { NotificationSendResult } from './ports/notification.port';
import { PushSenderPort } from './ports/push-sender.port';

export interface PushContent {
  title: string;
  body: string;
  url?: string;
}

/**
 * Máy đã đăng ký push của chủ nuôi và việc gửi push tới họ.
 *
 * - `NOTIFICATION_PROVIDER=log`: chỉ ghi log, giống các kênh khác. Đọc thẳng cấu hình chứ
 *   không qua NotificationProviderRegistry: registry dùng PushNotificationProvider, mà
 *   provider đó lại dùng service này - đi qua registry sẽ thành vòng DI.
 * - Token Expo báo `DeviceNotRegistered` (gỡ app, tắt thông báo) bị xoá ngay để lần sau
 *   không gửi vào chỗ chết.
 */
@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    @InjectRepository(DeviceToken) private readonly devices: Repository<DeviceToken>,
    private readonly sender: PushSenderPort,
    private readonly configService: ConfigService,
  ) {}

  private isSimulated(): boolean {
    const mode = this.configService.get<string>('notification.provider');
    return mode === 'log' || !mode;
  }

  /** Đăng ký (hoặc chuyển chủ) một token cho người dùng đang đăng nhập trên máy đó. */
  async registerDevice(params: {
    userId: string;
    phone: string;
    token: string;
    platform: DevicePlatform;
  }): Promise<{ registered: true }> {
    await this.devices.upsert(
      {
        userId: params.userId,
        phone: params.phone,
        token: params.token,
        platform: params.platform,
        lastSeenAt: new Date(),
        deletedAt: null,
      },
      { conflictPaths: ['token'] },
    );
    return { registered: true };
  }

  /** Đăng xuất: máy này thôi nhận push của tài khoản. Token của người khác không bị đụng. */
  async unregisterDevice(userId: string, token: string): Promise<void> {
    await this.devices.delete({ userId, token });
  }

  async hasDevicesForPhone(phone: string): Promise<boolean> {
    return (await this.devices.count({ where: { phone } })) > 0;
  }

  sendToUser(userId: string, content: PushContent): Promise<NotificationSendResult> {
    return this.sendTo({ userId }, content);
  }

  sendToPhone(phone: string, content: PushContent): Promise<NotificationSendResult> {
    return this.sendTo({ phone }, content);
  }

  private async sendTo(
    where: { userId: string } | { phone: string },
    content: PushContent,
  ): Promise<NotificationSendResult> {
    const devices = await this.devices.find({ where });
    if (devices.length === 0) {
      return { success: false, error: 'Chủ nuôi chưa đăng ký máy nhận thông báo đẩy' };
    }

    if (this.isSimulated()) {
      this.logger.log(
        `--> [PUSH] ${devices.length} máy | ${content.title} | ${content.body}` +
          (content.url ? ` | ${content.url}` : ''),
      );
      return { success: true, providerMessageId: `log-${Date.now()}` };
    }

    let tickets;
    try {
      tickets = await this.sender.send(devices.map((d) => ({ to: d.token, ...content })));
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }

    const gone = devices.filter((_, i) => tickets[i]?.deviceGone).map((d) => d.id);
    if (gone.length > 0) await this.devices.delete({ id: In(gone) });

    const delivered = tickets.filter((t) => t.ok).length;
    if (delivered > 0) return { success: true, providerMessageId: `expo-${delivered}` };
    return { success: false, error: tickets.find((t) => t.error)?.error ?? 'Expo không nhận tin' };
  }
}
