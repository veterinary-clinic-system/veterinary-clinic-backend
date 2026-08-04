/**
 * Not present as an explicit attribute in diagram.jpg's Appointment box, but required to
 * implement Section 4.1.2 (receptionist adjusts bookings, cancellations, no-shows) and the
 * calendar's free/busy logic in Section 5. Documented in CLAUDE.md as an added field.
 */
export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

/** Statuses that still hold the doctor's calendar slot and must block re-booking it. */
export const SLOT_BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
];

/**
 * Mot khi vao mot trong ba trang thai nay, lich hen KHONG BAO GIO doi trang thai
 * nua - phien kham da ket thuc (hoan tat/huy/khong den) la su kien lich su, khong
 * the "mo lai" bang PATCH.
 */
export const TERMINAL_APPOINTMENT_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
]);

/**
 * Thu tu tien trien cua 4 trang thai CHUA ket thuc. Hien tai KHONG co endpoint nao
 * chu dong dat CONFIRMED/CHECKED_IN/IN_PROGRESS (chi PENDING luc dat lich, va
 * COMPLETED luc bac si ghi phieu kham) - nen luat o day CHI cam lui (vi du
 * IN_PROGRESS -> PENDING), khong bat buoc phai di qua tung buoc mot truoc khi toi
 * trang thai ket thuc. Sau nay neu them man hinh "le tan check-in" thi thu tu nay
 * la cho de gan luat chuyen tiep chat hon.
 */
const NON_TERMINAL_ORDER: Record<
  Exclude<
    AppointmentStatus,
    AppointmentStatus.COMPLETED | AppointmentStatus.CANCELLED | AppointmentStatus.NO_SHOW
  >,
  number
> = {
  [AppointmentStatus.PENDING]: 0,
  [AppointmentStatus.CONFIRMED]: 1,
  [AppointmentStatus.CHECKED_IN]: 2,
  [AppointmentStatus.IN_PROGRESS]: 3,
};

/**
 * True neu chuyen tu `from` sang `to` la hop le. Quy tac:
 *   1. Giu nguyen trang thai (`from === to`) luon hop le - PATCH chi doi truong
 *      khac (notes, priorityColor) van thuong gui kem status hien tai.
 *   2. Da o trang thai KET THUC (COMPLETED/CANCELLED/NO_SHOW) thi KHONG the doi
 *      sang bat ky trang thai nao khac nua - day la loi that su tung xay ra
 *      (PATCH mot lich COMPLETED lui ve PENDING).
 *   3. Tu trang thai CHUA ket thuc, duoc phep di thang toi bat ky trang thai ket
 *      thuc nao (vi du PENDING -> COMPLETED khi bac si ghi phieu kham ma khong ai
 *      tung bam "check-in" rieng - xem ghi chu tren NON_TERMINAL_ORDER).
 *   4. Giua hai trang thai CHUA ket thuc, chi cho di TOI (thu tu tang dan trong
 *      NON_TERMINAL_ORDER) - khong cho lui.
 */
export function isValidAppointmentStatusTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  if (from === to) return true;
  if (TERMINAL_APPOINTMENT_STATUSES.has(from)) return false;
  if (TERMINAL_APPOINTMENT_STATUSES.has(to)) return true;

  return (
    NON_TERMINAL_ORDER[to as keyof typeof NON_TERMINAL_ORDER] >
    NON_TERMINAL_ORDER[from as keyof typeof NON_TERMINAL_ORDER]
  );
}
