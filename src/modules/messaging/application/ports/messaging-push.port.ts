/**
 * Cổng đẩy thông báo ra máy của người nhận (app chủ nuôi) khi họ không mở app. Bản cài
 * thật là PushNotificationsService của module notification; người không có máy đăng ký
 * (bác sĩ dùng web) thì lời gọi không làm gì.
 */
export abstract class MessagingPushPort {
  abstract sendToUser(
    userId: string,
    content: {
      title: string;
      body: string;
      url?: string;
      /** Kênh thông báo Android - cuộc gọi đến dùng kênh 'calls' (chuông, ưu tiên cao nhất). */
      channelId?: string;
      /** Dữ liệu kèm cho app (vd. `{ kind: 'call' }` để app ẩn khi đang mở). */
      data?: Record<string, string>;
      /** Chỉ dữ liệu: app tự dựng thông báo (chuông cuộc gọi toàn màn hình). */
      dataOnly?: boolean;
    },
  ): Promise<unknown>;

  /** Người này có máy nhận push không (để đổ chuông qua push khi họ không mở app). */
  abstract hasDevices(userId: string): Promise<boolean>;
}
