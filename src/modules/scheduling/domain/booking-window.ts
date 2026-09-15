import { addDays, startOfDay } from 'date-fns';

export function earliestSelfBookableStart(now: Date = new Date()): Date {
  return startOfDay(addDays(now, 1));
}

export const SELF_BOOKING_TOO_SOON_MESSAGE =
  'Chỉ có thể đặt lịch từ ngày mai trở đi. Nếu cần khám trong hôm nay, vui lòng đến trực tiếp phòng khám hoặc gọi cho quầy lễ tân.';
