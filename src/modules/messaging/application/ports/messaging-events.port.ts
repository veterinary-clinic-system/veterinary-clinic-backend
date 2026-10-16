/**
 * Cổng phát sự kiện realtime của module nhắn tin. Tầng application chỉ biết "gửi sự kiện
 * này tới người dùng kia"; cách gửi (Socket.IO, room theo user) nằm ở presentation.
 */
export abstract class MessagingEventsPort {
  /** Gửi tới mọi tab đang mở của từng người dùng. */
  abstract emitToUsers(userIds: string[], event: string, payload: unknown): void;

  /** Gửi tới đúng một kết nối - dùng cho tín hiệu WebRTC, vốn chỉ thuộc về tab đã nhận cuộc gọi. */
  abstract emitToSocket(socketId: string, event: string, payload: unknown): void;

  abstract isUserOnline(userId: string): boolean;
}
