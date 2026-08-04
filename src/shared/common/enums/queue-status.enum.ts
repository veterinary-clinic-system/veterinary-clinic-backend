/**
 * Trang thai mot luot cho tai quay le tan (hang cho trong ngay).
 *
 * Khong co trong diagram.jpg - them de phuc vu nhom chuc nang le tan: xac nhan khach
 * da den, tao luot kham khong dat lich, dua vao hang cho, gan bac si. Vong doi tach
 * rieng khoi `AppointmentStatus` vi mot luot cho co the ton tai TRUOC khi co
 * `Appointment` (khach vang lai chua duoc gan bac si nen chua chiem khung gio nao).
 */
export enum QueueStatus {
  /** Da vao hang cho, CHUA co bac si phu trach. */
  WAITING = 'WAITING',
  /** Da gan bac si, dang doi duoc goi vao phong. */
  ASSIGNED = 'ASSIGNED',
  /** Dang trong phong kham. */
  IN_ROOM = 'IN_ROOM',
  /** Kham xong, roi khoi hang cho. */
  DONE = 'DONE',
  /** Khach bo ve / le tan huy luot cho. */
  CANCELLED = 'CANCELLED',
}

/** Cac trang thai con "song" - van hien trong man hinh hang cho va van chiem cho cua thu cung. */
export const ACTIVE_QUEUE_STATUSES: QueueStatus[] = [
  QueueStatus.WAITING,
  QueueStatus.ASSIGNED,
  QueueStatus.IN_ROOM,
];

/** Da roi hang cho - khong the chuyen sang trang thai khac nua. */
export const TERMINAL_QUEUE_STATUSES: ReadonlySet<QueueStatus> = new Set([
  QueueStatus.DONE,
  QueueStatus.CANCELLED,
]);

/** Nguon goc luot cho: khach co dat lich truoc hay khach vang lai. */
export enum QueueSource {
  /** Khach da dat lich online/qua dien thoai, le tan bam "xac nhan da den". */
  APPOINTMENT = 'APPOINTMENT',
  /** Khach den truc tiep khong dat lich (walk-in). */
  WALK_IN = 'WALK_IN',
}

const NON_TERMINAL_ORDER: Record<
  Exclude<QueueStatus, QueueStatus.DONE | QueueStatus.CANCELLED>,
  number
> = {
  [QueueStatus.WAITING]: 0,
  [QueueStatus.ASSIGNED]: 1,
  [QueueStatus.IN_ROOM]: 2,
};

/**
 * Cung quy tac voi `isValidAppointmentStatusTransition`: giu nguyen luon hop le, da
 * ket thuc thi khong mo lai duoc, tu trang thai chua ket thuc duoc di thang toi
 * DONE/CANCELLED, va giua hai trang thai chua ket thuc chi cho di TOI (khong lui).
 */
export function isValidQueueStatusTransition(from: QueueStatus, to: QueueStatus): boolean {
  if (from === to) return true;
  if (TERMINAL_QUEUE_STATUSES.has(from)) return false;
  if (TERMINAL_QUEUE_STATUSES.has(to)) return true;

  return (
    NON_TERMINAL_ORDER[to as keyof typeof NON_TERMINAL_ORDER] >
    NON_TERMINAL_ORDER[from as keyof typeof NON_TERMINAL_ORDER]
  );
}
