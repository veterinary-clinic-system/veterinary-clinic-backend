import { CallMedia, CallStatus, MessageKind } from '@/shared/common/enums/messaging.enum';

const PREVIEW_MAX_LENGTH = 120;

/** Dòng tóm tắt hiện ở danh sách cuộc trò chuyện. */
export function messagePreview(kind: MessageKind, body: string | null): string {
  if (kind === MessageKind.IMAGE && !body) {
    return '[Hình ảnh]';
  }
  const text = (body ?? '').replace(/\s+/g, ' ').trim();
  return text.length > PREVIEW_MAX_LENGTH ? `${text.slice(0, PREVIEW_MAX_LENGTH - 1)}…` : text;
}

/** Câu ghi lại một cuộc gọi đã kết thúc, chèn vào cuộc trò chuyện như một tin nhắn hệ thống. */
export function callLogText(media: CallMedia, status: CallStatus, durationSeconds: number): string {
  const label = media === CallMedia.VIDEO ? 'Cuộc gọi video' : 'Cuộc gọi thoại';
  switch (status) {
    case CallStatus.ENDED:
      return `${label} · ${formatDuration(durationSeconds)}`;
    case CallStatus.MISSED:
      return `${label} nhỡ`;
    case CallStatus.REJECTED:
      return `${label} bị từ chối`;
    case CallStatus.CANCELLED:
      return `${label} đã huỷ`;
    default:
      return label;
  }
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
