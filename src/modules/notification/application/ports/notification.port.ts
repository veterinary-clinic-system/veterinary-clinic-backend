import { NotificationChannel } from '@/shared/common/enums/notification.enum';

export interface NotificationMessage {
  recipientPhone: string;
  message: string;

  recipientEmail?: string | null;

  subject?: string;

  /** Chỉ để ghi log/đối soát - nhà cung cấp thật đã ngầm định kênh của chính nó. */
  channel?: NotificationChannel;
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
}
