export interface PushMessage {
  to: string;
  title: string;
  body: string;
  /** Màn hình app mở khi bấm vào thông báo. */
  url?: string;
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
