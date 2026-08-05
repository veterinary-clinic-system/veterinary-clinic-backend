/**
 * Vong doi don dat hang - SRS UC-05.
 *
 * `PARTIALLY_RECEIVED` la trang thai bat buoc chu khong phai tuy chon: nha cung cap
 * giao thieu la chuyen thuong ngay, va neu chi co RECEIVED/ORDERED thi don giao thieu
 * hoac bi ke sai thanh "da nhan du" (mat dau vet con thieu bao nhieu), hoac ket mai o
 * "da dat" (khong biet da nhan duoc phan nao).
 */
export enum PurchaseOrderStatus {
  /** Dang soan, chua gui nha cung cap. Sua thoai mai. */
  DRAFT = 'DRAFT',
  /** Da gui nha cung cap, dang cho hang. */
  ORDERED = 'ORDERED',
  /** Da nhan mot phan. */
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  /** Da nhan du moi dong. Khoa, khong sua duoc nua. */
  RECEIVED = 'RECEIVED',
  /** Huy don. Khoa, khong sua duoc nua. */
  CANCELLED = 'CANCELLED',
}

/** Trang thai cuoi - don o cac trang thai nay khong con sua duoc (acceptance P6-T4). */
export const CLOSED_PURCHASE_ORDER_STATUSES: readonly PurchaseOrderStatus[] = [
  PurchaseOrderStatus.RECEIVED,
  PurchaseOrderStatus.CANCELLED,
];
