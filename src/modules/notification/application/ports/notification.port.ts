import { NotificationChannel } from '@/shared/common/enums/notification.enum';

export interface NotificationMessage {
  recipientPhone: string;
  message: string;

  recipientEmail?: string | null;

  subject?: string;

  /** Chỉ để ghi log/đối soát - nhà cung cấp thật đã ngầm định kênh của chính nó. */
  channel?: NotificationChannel;

  /** Màn hình app mở khi chủ nuôi bấm vào push (vd. `/appointments/<id>`); kênh khác bỏ qua. */
  url?: string;
}

export interface NotificationSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface NotificationProvider {
  send(message: NotificationMessage): Promise<NotificationSendResult>;
}

export const NOTIFICATION_DISPATCHER = Symbol('NOTIFICATION_DISPATCHER');

export interface NotificationDispatcher {
  resolve(channel: NotificationChannel): NotificationProvider;

  /** true khi NOTIFICATION_PROVIDER=log: thông báo chỉ được ghi log, không tới tay khách. */
  isSimulated(): boolean;

  /**
   * false khi kênh chắc chắn không gửi được vì THIẾU cấu hình (chưa có token Zalo/template
   * ZNS). Tạo dòng cho kênh đó chỉ sinh 5 lượt thử vô ích và báo khách "sẽ thử lại" sai sự thật.
   */
  isConfigured(channel: NotificationChannel): boolean;
}
