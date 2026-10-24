export interface PushMessage {
  to: string;
  title: string;
  body: string;
  /** Màn hình app mở khi bấm vào thông báo. */
  url?: string;
  channelId?: string;
  data?: Record<string, string>;
  /**
   * Push chỉ có dữ liệu (không tiêu đề/nội dung): Android không tự hiện thông báo mà đánh
   * thức tác vụ nền của app, kể cả khi app đã tắt - dùng cho chuông cuộc gọi toàn màn hình.
   */
  dataOnly?: boolean;
}

/** Kết quả theo đúng thứ tự `messages`. `deviceGone` = token không còn hợp lệ, nên xoá. */
export interface PushTicket {
  ok: boolean;
  deviceGone?: boolean;
  error?: string;
}

/**
 * Cổng gửi push. Tầng application chỉ biết "gửi các tin này tới các token này"; gọi HTTP
 * tới Expo nằm ở infrastructure (ExpoPushSender).
 */
export abstract class PushSenderPort {
  abstract send(messages: PushMessage[]): Promise<PushTicket[]>;
}
