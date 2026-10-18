/**
 * Cổng đẩy thông báo ra máy của người nhận (app chủ nuôi) khi họ không mở app. Bản cài
 * thật là PushNotificationsService của module notification; người không có máy đăng ký
 * (bác sĩ dùng web) thì lời gọi không làm gì.
 */
export abstract class MessagingPushPort {
  abstract sendToUser(
    userId: string,
    content: { title: string; body: string; url?: string },
  ): Promise<unknown>;
}
