/**
 * Trang thai mot LAN thanh toan - SRS FR-21.
 *
 * Khac han trang thai hoa don (`InvoiceStatus`): mot hoa don co nhieu lan tra, va trang
 * thai hoa don la KET QUA cong don cua chung. Mot lan tra that bai khong lam hoa don
 * that bai - no chi khong duoc tinh vao so da thu.
 */
export enum PaymentStatus {
  /** Da khoi tao o cong thanh toan, chua co xac nhan tien ve (VNPay cho IPN). */
  PENDING = 'PENDING',
  /** Tien da thu duoc. Chi trang thai nay (va `REFUNDED`) duoc tinh vao so da thu. */
  SUCCESS = 'SUCCESS',
  /** Cong thanh toan tu choi, hoac khach bo giua chung. Khong tinh vao so da thu. */
  FAILED = 'FAILED',
  /**
   * Dong hoan tien - `amount` LUON AM (P8-T3).
   *
   * Hoan tien la mot dong so cai moi chu khong phai sua dong da tra: chung tu tien
   * khong duoc viet de len, y het nguyen tac cua `inventory_transactions`.
   */
  REFUNDED = 'REFUNDED',
}

/**
 * Cac trang thai duoc tinh vao so tien da thu cua hoa don.
 *
 * `REFUNDED` co mat trong danh sach nay LA CO CHU DICH: dong hoan tien mang so am, nen
 * cong no vao chinh la tru di. Bo no ra thi hoa don da hoan tien van hien "da thu du".
 */
export const SETTLED_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.SUCCESS,
  PaymentStatus.REFUNDED,
];
