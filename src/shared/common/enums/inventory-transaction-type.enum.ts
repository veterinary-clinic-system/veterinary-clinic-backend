/**
 * Loai giao dich kho - SRS FR-18-02.
 *
 * Phan biet ro giua ba duong hang RA khoi kho, vi bao cao o P10 doi xu voi chung khac
 * nhau hoan toan: `SALE` la doanh thu, `DISPENSE` la thuoc cap theo don (da tinh tien
 * trong hoa don kham), con `DAMAGED`/`EXPIRED`/`LOSS` la chi phi that thoat. Gop lai
 * thanh mot loai "xuat" thi khong con tach duoc gia von hang ban ra khoi hao hut.
 */
export enum InventoryTransactionType {
  /** Nhap hang tu nha cung cap (P6-T5). Luon duong. */
  PURCHASE = 'PURCHASE',
  /** Ban le qua POS (P8). Luon am. */
  SALE = 'SALE',
  /** Cap thuoc theo don (P7). Luon am. */
  DISPENSE = 'DISPENSE',
  /** Hang hong/vo. Luon am. */
  DAMAGED = 'DAMAGED',
  /** Huy lo qua han. Luon am. */
  EXPIRED = 'EXPIRED',
  /** Kiem ke (P6-T6) - loai DUY NHAT duoc phep mang dau bat ky. */
  ADJUSTMENT = 'ADJUSTMENT',
  /** That lac khong ro nguyen nhan. Luon am. */
  LOSS = 'LOSS',
  /** Khach tra hang hoac tra hang ve nha cung cap - dau tuy chieu tra. */
  RETURN = 'RETURN',
}

/**
 * Chung tu goc cua mot dong so cai.
 *
 * Cap `(referenceType, referenceId)` la quan he da hinh CO CHU DICH thay vi tam cot
 * khoa ngoai nullable: so cai phai tro ve duoc phieu nhap, hoa don, don thuoc va
 * phieu kiem ke - bon bang o bon bounded context khac nhau. Bon khoa ngoai nullable
 * se bat bang nay biet ten moi bang nghiep vu se ra doi ve sau, va moi phase moi lai
 * them mot cot.
 */
export enum InventoryReferenceType {
  GOODS_RECEIPT = 'GOODS_RECEIPT',
  INVOICE = 'INVOICE',
  PRESCRIPTION = 'PRESCRIPTION',
  STOCK_TAKE = 'STOCK_TAKE',
  /** Thao tac tay tren man hinh kho, khong co chung tu nao khac. */
  MANUAL = 'MANUAL',
}

/**
 * Cac loai BAT BUOC lam giam ton. Dung de chan loi lap trinh o `InventoryService`:
 * goi `issue` voi `type: PURCHASE` la mot loi that su, khong phai truong hop hop le.
 */
export const ISSUE_TRANSACTION_TYPES: readonly InventoryTransactionType[] = [
  InventoryTransactionType.SALE,
  InventoryTransactionType.DISPENSE,
  InventoryTransactionType.DAMAGED,
  InventoryTransactionType.EXPIRED,
  InventoryTransactionType.LOSS,
  InventoryTransactionType.RETURN,
];
