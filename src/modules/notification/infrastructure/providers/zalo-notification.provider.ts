import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationMessage,
  NotificationProvider,
  NotificationSendResult,
} from '@/modules/notification/application/ports/notification.port';

const ZALO_ZNS_SEND_URL = 'https://business.openapi.zalo.me/message/template';

/** Giới hạn độ dài một tham số template ZNS (tài liệu Zalo: tối đa 400 ký tự/tham số). */
const ZNS_PARAM_MAX_LENGTH = 400;

/**
 * Gửi tin qua Zalo Notification Service (ZNS) - kênh DUY NHẤT của Zalo gửi được tới một
 * SỐ ĐIỆN THOẠI. Tin "tư vấn" của OA (`/v3.0/oa/message/cs`) chỉ nhận `user_id` của người
 * đã quan tâm OA, nên gửi số điện thoại vào đó luôn bị Zalo từ chối - bản trước làm vậy.
 *
 * ZNS bắt buộc dùng template đã được Zalo duyệt. Template của phòng khám cần khai báo
 * hai tham số: `title` (tiêu đề) và `content` (nội dung) - xem ZALO_ZNS_TEMPLATE_ID.
 */
@Injectable()
export class ZaloNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger('NotificationProvider:zalo');

  constructor(private readonly configService: ConfigService) {}

  async send(message: NotificationMessage): Promise<NotificationSendResult> {
    const accessToken = this.configService.get<string>('notification.zalo.oaAccessToken');
    const templateId = this.configService.get<string>('notification.zalo.znsTemplateId');

    if (!accessToken) {
      return { success: false, error: 'ZALO_OA_ACCESS_TOKEN chưa được cấu hình' };
    }
    if (!templateId) {
      return { success: false, error: 'ZALO_ZNS_TEMPLATE_ID chưa được cấu hình' };
    }

    const phone = toZaloPhone(message.recipientPhone);
    if (!phone) {
      return { success: false, error: `Số điện thoại không hợp lệ: ${message.recipientPhone}` };
    }

    try {
      const response = await fetch(ZALO_ZNS_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: accessToken },
        body: JSON.stringify({
          phone,
          template_id: templateId,
          template_data: {
            title: truncate(message.subject ?? 'Thông báo từ phòng khám thú y'),
            content: truncate(message.message),
          },
        }),
      });

      const body = (await response.json()) as {
        error?: number;
        message?: string;
        data?: { msg_id?: string };
      };
      if (!response.ok || body.error) {
        return { success: false, error: body.message ?? `Zalo ZNS API lỗi ${response.status}` };
      }

      return { success: true, providerMessageId: body.data?.msg_id };
    } catch (error) {
      this.logger.error(`Gửi Zalo thất bại: ${(error as Error).message}`);
      return { success: false, error: (error as Error).message };
    }
  }
}

/** ZNS nhận số dạng quốc tế không dấu "+": 0912345678 -> 84912345678. */
export function toZaloPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (/^84\d{9}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `84${digits.slice(1)}`;
  return null;
}

function truncate(value: string): string {
  return value.length <= ZNS_PARAM_MAX_LENGTH
    ? value
    : `${value.slice(0, ZNS_PARAM_MAX_LENGTH - 1)}…`;
}
