import { NotificationChannel } from '@/shared/common/enums/notification.enum';

export interface NotificationMessage {
  recipientPhone: string;
  message: string;
  /**
   * Dia chi thu cua nguoi nhan - CHI kenh `EMAIL` dung toi (P10-T6).
   *
   * De tuy chon chu khong bat buoc: phan lon khach cua phong kham chi de lai so dien
   * thoai, va bat buoc truong nay se lam moi lan nhac lich qua SMS phai bia ra mot dia
   * chi rong. Kenh email tu tu choi khi khong co no - xem `EmailNotificationProvider`.
   */
  recipientEmail?: string | null;
  /** Tieu de thu. Cac kenh khac bo qua. */
  subject?: string;
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

/**
 * Port cho viec CHON kenh gui.
 *
 * Tang application biet "gui qua kenh SMS" nhung khong duoc biet kenh do duoc hien
 * thuc bang nha cung cap nao - do la quyet dinh cua tang infrastructure va thay doi
 * theo cau hinh/hop dong. Adapter hien tai la NotificationProviderRegistry.
 */
export const NOTIFICATION_DISPATCHER = Symbol('NOTIFICATION_DISPATCHER');

export interface NotificationDispatcher {
  resolve(channel: NotificationChannel): NotificationProvider;
}
