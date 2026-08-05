/**
 * Trang thai hoa don - SRS FR-20, P8-T2.
 *
 * ```
 * PENDING ──→ PARTIALLY_PAID ──→ PAID ──→ REFUNDED
 *    │              │              │
 *    └──→ CANCELLED └──────────────┴──→ REFUNDED
 * ```
 *
 * KHONG DAT BANG TAY. Cot `invoices.status` la BAN CACHE cua mot phep tinh tren bang
 * `payments`, y het `inventory_items.inventory_quantity` la ban cache cua tong cac lo
 * (quyet dinh (B) cua P6). Moi thay doi tien phai di qua `PaymentsService`, va service
 * do goi `syncStatus` trong CUNG transaction. Cho nao cung nhau ghi thang trang thai la
 * cho do se lech voi so tien that.
 */
export enum InvoiceStatus {
  /** Chua thu duoc dong nao. */
  PENDING = 'PENDING',
  /** Da thu mot phan - khach hen tra not. */
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  /** Da thu du. */
  PAID = 'PAID',
  /** Huy truoc khi thu bat cu dong nao (BR-14: da tra roi thi phai hoan tien, khong huy). */
  CANCELLED = 'CANCELLED',
  /** Da hoan tien - co it nhat mot dong `payments` trang thai `REFUNDED`. */
  REFUNDED = 'REFUNDED',
}

/**
 * Suy trang thai hoa don tu so tien da thu.
 *
 * `CANCELLED` va `REFUNDED` la hai trang thai DINH: chung ghi lai mot quyet dinh nghiep
 * vu (huy phieu / tra lai tien) chu khong phai mot nguong so tien, nen phep suy nay nhan
 * chung nhu du kien dau vao thay vi tu tinh ra.
 *
 * @param totalAmount so phai thu da chot tren hoa don
 * @param netPaidAmount tong `amount` cua cac dong `payments` da chot (`SUCCESS` +
 *   `REFUNDED`, tuc la da tru phan hoan lai)
 */
export function deriveInvoiceStatus(params: {
  totalAmount: number;
  netPaidAmount: number;
  hasRefund: boolean;
  isCancelled: boolean;
}): InvoiceStatus {
  if (params.isCancelled) {
    return InvoiceStatus.CANCELLED;
  }
  if (params.hasRefund) {
    return InvoiceStatus.REFUNDED;
  }
  // Hoa don 0 dong (giam gia 100%, hang tang kem) khong co gi de thu - PAID ngay, va
  // KHONG di qua `payments`: mot dong thanh toan 0 dong la mot chung tu rong.
  if (params.totalAmount <= 0) {
    return InvoiceStatus.PAID;
  }
  if (params.netPaidAmount <= 0) {
    return InvoiceStatus.PENDING;
  }
  return params.netPaidAmount >= params.totalAmount
    ? InvoiceStatus.PAID
    : InvoiceStatus.PARTIALLY_PAID;
}

/** Hoa don o cac trang thai nay KHONG duoc sua dong nua - BR-14 (P8-T3). */
export const LOCKED_INVOICE_STATUSES: ReadonlySet<InvoiceStatus> = new Set([
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.REFUNDED,
  InvoiceStatus.CANCELLED,
]);
