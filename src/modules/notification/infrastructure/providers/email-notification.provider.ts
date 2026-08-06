import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import {
  NotificationMessage,
  NotificationProvider,
  NotificationSendResult,
} from '@/modules/notification/application/ports/notification.port';

/**
 * Gui thu qua SMTP - SRS FR-23 (P10-T6).
 *
 * Cung khuon voi `SmsNotificationProvider` va `ZaloNotificationProvider`: doc cau hinh
 * tu `ConfigService`, THAT BAI DONG khi thieu cau hinh (tra `success: false` kem ly do
 * chu khong nem loi), va khong bao gio tu quyet dinh doi kenh.
 *
 * TRANSPORTER DUOC TAO MOT LAN roi dung lai: moi lan `createTransport` la mot pool ket
 * noi moi, va tao lai cho tung email se mo mot phien SMTP moi cho moi lan gui - cham va
 * de bi nha cung cap chan vi mo qua nhieu ket noi.
 *
 * KHONG TU ROI VE `LogNotificationProvider` o day. Viec chon nha cung cap la cua
 * `NotificationProviderRegistry` - mot adapter tu quyet dinh "thoi de tao ghi log vay"
 * se lam ca he thong noi doi: bao cao gui thanh cong trong khi khong co thu nao roi di.
 */
@Injectable()
export class EmailNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger('NotificationProvider:email');
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async send(message: NotificationMessage): Promise<NotificationSendResult> {
    if (!message.recipientEmail) {
      return { success: false, error: 'Người nhận không có địa chỉ email' };
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      return { success: false, error: 'SMTP_HOST chưa được cấu hình' };
    }

    try {
      const info = await transporter.sendMail({
        from: this.configService.get<string>('notification.email.from'),
        to: message.recipientEmail,
        subject: message.subject ?? 'Thông báo từ phòng khám thú y',
        text: message.message,
      });

      return { success: true, providerMessageId: info.messageId };
    } catch (error) {
      this.logger.error(`Gửi email thất bại: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  }

  /** `null` khi chua cau hinh SMTP - nguoi goi tu bao that bai kem ly do. */
  private getTransporter(): Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.configService.get<string>('notification.email.host');
    if (!host) {
      return null;
    }

    const port = this.configService.get<number>('notification.email.port') ?? 587;
    const user = this.configService.get<string>('notification.email.user');
    const pass = this.configService.get<string>('notification.email.pass');

    this.transporter = createTransport({
      host,
      port,
      // 465 la cong SMTPS (TLS ngay tu dau); 587 dung STARTTLS nen `secure` phai la false
      // roi moi nang cap. Dat cung `secure: true` cho 587 se treo cho bat tay.
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    return this.transporter;
  }
}
