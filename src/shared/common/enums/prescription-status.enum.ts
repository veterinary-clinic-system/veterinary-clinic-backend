/**
 * Vong doi mot don thuoc - SRS FR-11-03.
 *
 * ```
 * PRESCRIBED  ──→  DISPENSING  ──→  DISPENSED
 * (bac si ke)     (duoc si soan)   (da giao, kho da tru)
 *                      │
 *                      └──→ CANCELLED
 * ```
 *
 * `DISPENSING` khong phai trang thai thua: no danh dau don DA CO NGUOI NHAN o quay
 * thuoc. Khong co no thi hai duoc si co the cung soan mot don ma khong ai biet, va
 * viec tru kho se phu thuoc hoan toan vao ai bam nut truoc.
 *
 * `DISPENSED` la trang thai cuoi va KHONG lui duoc: no di kem cac dong so cai kho bat
 * bien (loai `DISPENSE`). Cap nham thi ghi mot dieu chinh kiem ke co ly do, khong phai
 * mo lai don.
 */
export enum PrescriptionStatus {
  /** Bac si da ke, dang cho quay thuoc. */
  PRESCRIBED = 'PRESCRIBED',
  /** Duoc si dang soan thuoc. Kho CHUA bi tru o buoc nay. */
  DISPENSING = 'DISPENSING',
  /** Da giao cho khach, kho da tru va so cai da ghi. */
  DISPENSED = 'DISPENSED',
  /** Huy don (bac si doi y lenh, khach khong lay thuoc). Kho khong bi dong toi. */
  CANCELLED = 'CANCELLED',
}

/** Da ket thuc - khong chuyen sang trang thai nao khac duoc nua. */
export const TERMINAL_PRESCRIPTION_STATUSES: ReadonlySet<PrescriptionStatus> = new Set([
  PrescriptionStatus.DISPENSED,
  PrescriptionStatus.CANCELLED,
]);

/** Cac trang thai con sua duoc dong thuoc (acceptance P7-T2). */
export const EDITABLE_PRESCRIPTION_STATUSES: ReadonlySet<PrescriptionStatus> = new Set([
  PrescriptionStatus.PRESCRIBED,
]);

const NON_TERMINAL_ORDER: Record<
  Exclude<PrescriptionStatus, PrescriptionStatus.DISPENSED | PrescriptionStatus.CANCELLED>,
  number
> = {
  [PrescriptionStatus.PRESCRIBED]: 0,
  [PrescriptionStatus.DISPENSING]: 1,
};

/**
 * Cung quy tac voi `isValidAppointmentStatusTransition` va
 * `isValidQueueStatusTransition`: giu nguyen luon hop le, da ket thuc thi khong mo lai
 * duoc, tu trang thai chua ket thuc di thang toi trang thai cuoi duoc, va giua hai
 * trang thai chua ket thuc chi cho di TOI (khong lui).
 *
 * Viet lai theo dung khuon do thay vi nghi ra luat rieng: ba vong doi cua he thong ma
 * moi cai mot kieu thi nguoi doc phai hoc lai tu dau moi lan.
 */
export function isValidPrescriptionStatusTransition(
  from: PrescriptionStatus,
  to: PrescriptionStatus,
): boolean {
  if (from === to) return true;
  if (TERMINAL_PRESCRIPTION_STATUSES.has(from)) return false;
  if (TERMINAL_PRESCRIPTION_STATUSES.has(to)) return true;

  return (
    NON_TERMINAL_ORDER[to as keyof typeof NON_TERMINAL_ORDER] >
    NON_TERMINAL_ORDER[from as keyof typeof NON_TERMINAL_ORDER]
  );
}
