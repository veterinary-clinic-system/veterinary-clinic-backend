import { addDays, startOfDay } from 'date-fns';

/**
 * Cua so dat lich cua KHACH (guest hoac chu thu cung tu dat).
 *
 * Phan hoi nghiem thu: "Dat lich hen thi an di (lam mo khong cho chon) thoi gian trong
 * qua khu. De xuat la chi duoc dat lich tu 'ngay mai' tro di." Phong kham can toi thieu
 * mot ngay de xac nhan lich va chuan bi, nen moc som nhat la 00:00 cua ngay hom sau.
 *
 * CHI ap dung cho duong tu dat. Le tan van xep duoc lich trong hom nay (khach dang dung
 * o quay), va viec doi lich cua nhan vien cung khong bi chan boi moc nay - xem
 * `AppointmentsService.createBooking`, noi quy tac chi chay khi `bookedByUserId` la null.
 */
export function earliestSelfBookableStart(now: Date = new Date()): Date {
  return startOfDay(addDays(now, 1));
}

/** Thong bao dung mot cho de API va giao dien noi cung mot cau. */
export const SELF_BOOKING_TOO_SOON_MESSAGE =
  'Chỉ có thể đặt lịch từ ngày mai trở đi. Nếu cần khám trong hôm nay, vui lòng đến trực tiếp phòng khám hoặc gọi cho quầy lễ tân.';
