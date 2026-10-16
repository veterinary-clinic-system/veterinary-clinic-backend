import { AppointmentStatus } from './appointment-status.enum';

export enum MessageKind {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  /** Dòng nhật ký cuộc gọi do hệ thống ghi vào cuộc trò chuyện khi cuộc gọi kết thúc. */
  CALL = 'CALL',
}

export enum CallMedia {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

export enum CallStatus {
  RINGING = 'RINGING',
  ACCEPTED = 'ACCEPTED',
  /** Người nhận bấm từ chối, hoặc đang bận một cuộc gọi khác. */
  REJECTED = 'REJECTED',
  /** Hết thời gian đổ chuông mà không ai nhấc máy. */
  MISSED = 'MISSED',
  /** Người gọi tự huỷ khi máy bên kia còn đang đổ chuông. */
  CANCELLED = 'CANCELLED',
  /** Đã nói chuyện rồi mới kết thúc. */
  ENDED = 'ENDED',
}

export const ACTIVE_CALL_STATUSES: ReadonlySet<CallStatus> = new Set([
  CallStatus.RINGING,
  CallStatus.ACCEPTED,
]);

/**
 * Chủ nuôi chỉ được nhắn với bác sĩ đã hoặc đang khám cho bé của mình: lịch hẹn phải
 * được phòng khám xác nhận trở đi. PENDING chưa có bác sĩ nhận; CANCELLED/NO_SHOW chưa
 * từng có buổi khám nào.
 */
export const MESSAGING_ELIGIBLE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
];
