import { NotificationChannel } from '@/shared/common/enums/notification.enum';

export interface NotificationMessage {
  recipientPhone: string;
  message: string;
  
  recipientEmail?: string | null;
  
  subject?: string;
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
}
