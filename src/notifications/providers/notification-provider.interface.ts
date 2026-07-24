export interface NotificationMessage {
  recipientPhone: string;
  message: string;
}

export interface NotificationSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * Section 5.3's "swappable notification-provider abstraction". Every channel (SMS,
 * Zalo, and the local-dev logging default) implements this; NotificationsService only
 * ever depends on this interface, never a concrete provider.
 */
export interface NotificationProvider {
  send(message: NotificationMessage): Promise<NotificationSendResult>;
}
