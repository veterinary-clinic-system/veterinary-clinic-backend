import { InventoryTransactionType } from '@/shared/common/enums/inventory-transaction-type.enum';

/**
 * Phan tinh toan THUAN cua nghiep vu kho - P6-T2/T3.
 *
 * Tach khoi `InventoryService` co chu dich: chon lo theo FEFO va tinh ton luy ke la
 * hai cho de sai nhat cua ca phase 6, nhung ca hai deu khong can CSDL de kiem chung.
 * De chung trong service thi muon test phai dung Postgres that; de o day thi test
 * chay bang `npm test` va chay o CI khong co CSDL.
 *
 * Cung ly do voi `scheduling/domain/slot-grid.util.ts`.
 */

/** Du lieu toi thieu cua mot lo de FEFO quyet dinh duoc. */
export interface AllocatableBatch {
  id: string;
  batchNo: string;
  /** `null` = hang khong co han dung. */
  expiryDate: string | null;
  quantity: number;
  receivedAt: Date;
}

/** Mot phan cua lenh xuat, roi vao dung mot lo. */
export interface BatchAllocation {
  batchId: string;
  batchNo: string;
  quantity: number;
}

/** Mot dong so cai chua ghi, da co san ton luy ke. */
export interface PlannedLedgerLine {
  batchId: string | null;
  quantityChange: number;
  quantityAfter: number;
}

/**
 * Khong du hang de xuat. La loi NGHIEP VU (nguoi dung yeu cau nhieu hon so co), nen
 * `InventoryService` doi no thanh 409 chu khong phai 500.
 */
export class InsufficientStockError extends Error {
  constructor(
    readonly requested: number,
    readonly available: number,
  ) {
    super(`Khong du ton kho: can ${requested}, kha dung ${available}`);
    this.name = 'InsufficientStockError';
  }
}

/** `YYYY-MM-DD` theo lich ngay, cung dinh dang voi cot `date` cua Postgres. */
export function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * BR-11: lo het han khong duoc ban, khong duoc cap phat.
 *
 * So sanh theo NGAY chu khong theo thoi diem: mot lo han 05/08/2026 van dung duoc het
 * ngay 05/08/2026. Lo khong co han dung khong bao gio het han.
 */
export function isExpired(batch: Pick<AllocatableBatch, 'expiryDate'>, today: string): boolean {
  return batch.expiryDate !== null && batch.expiryDate < today;
}

/** Tong so thuc su dung duoc - BR-11, da loai lo het han. */
export function availableQuantity(batches: readonly AllocatableBatch[], today: string): number {
  return batches.reduce((sum, batch) => (isExpired(batch, today) ? sum : sum + batch.quantity), 0);
}

/**
 * Sap xep FEFO - *First Expired, First Out* (BR-11).
 *
 * Lo co han di truoc lo khong han: hang khong han dung khong bao gio hong, de lai
 * cuoi khong mat gi; nguoc lai thi lo co han se nam cho toi luc phai huy.
 * Cung han thi lo nhap truoc di truoc (FIFO), va cung thoi diem nhap thi theo ma lo -
 * chi de ket qua tat dinh, test khong phu thuoc thu tu tra ve cua CSDL.
 */
function compareFefo(a: AllocatableBatch, b: AllocatableBatch): number {
  if (a.expiryDate !== b.expiryDate) {
    if (a.expiryDate === null) return 1;
    if (b.expiryDate === null) return -1;
    return a.expiryDate < b.expiryDate ? -1 : 1;
  }
  const receivedDiff = a.receivedAt.getTime() - b.receivedAt.getTime();
  if (receivedDiff !== 0) return receivedDiff;
  return a.batchNo.localeCompare(b.batchNo);
}

/**
 * Chia mot lenh xuat `quantity` ra cac lo theo FEFO.
 *
 * Kiem tra du hang TRUOC khi phan bo (chu khong vua chia vua kiem): acceptance cua
 * P6-T3 doi hoi xuat thieu hang thi KHONG duoc thay doi gi ca. Neu vua chia vua kiem
 * thi khi phat hien thieu o lo cuoi, cac lo truoc do da bi tru mat roi.
 *
 * @throws {InsufficientStockError} khi so kha dung (da loai lo het han) khong du.
 */
export function allocateFefo(
  batches: readonly AllocatableBatch[],
  quantity: number,
  today: string,
): BatchAllocation[] {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError('So luong xuat phai la so nguyen duong');
  }

  const usable = batches.filter((batch) => !isExpired(batch, today) && batch.quantity > 0);
  const available = usable.reduce((sum, batch) => sum + batch.quantity, 0);
  if (available < quantity) {
    throw new InsufficientStockError(quantity, available);
  }

  const allocations: BatchAllocation[] = [];
  let remaining = quantity;
  for (const batch of [...usable].sort(compareFefo)) {
    if (remaining === 0) break;
    const taken = Math.min(batch.quantity, remaining);
    allocations.push({ batchId: batch.id, batchNo: batch.batchNo, quantity: taken });
    remaining -= taken;
  }
  return allocations;
}

/**
 * Tinh `quantityAfter` luy ke cho mot chuoi thay doi ton, theo dung thu tu se ghi.
 *
 * Day la cho DUY NHAT tinh `quantityAfter`. Moi loi goi `InventoryService` deu di qua
 * ham nay, nho vay bat bien `quantityBefore + SUM(quantityChange) = quantityAfter cua
 * dong cuoi` la mot tinh chat cua ham thuan - kiem chung duoc bang unit test, khong
 * can dung CSDL len.
 *
 * @throws {RangeError} neu chuoi thay doi lam ton am o bat ky buoc nao (NFR-07).
 */
export function planLedgerLines(
  quantityBefore: number,
  changes: readonly { batchId: string | null; quantityChange: number }[],
): PlannedLedgerLine[] {
  let running = quantityBefore;
  return changes.map((change) => {
    running += change.quantityChange;
    if (running < 0) {
      throw new RangeError('Ton kho khong duoc am');
    }
    return {
      batchId: change.batchId,
      quantityChange: change.quantityChange,
      quantityAfter: running,
    };
  });
}

/**
 * Dau bat buoc cua tung loai giao dich - SRS FR-18-02.
 *
 * `ADJUSTMENT` va `RETURN` mang dau nao cung duoc (kiem ke co the thua hoac thieu;
 * tra hang co the la khach tra ve kho hoac kho tra ve nha cung cap). Cac loai con lai
 * chi mot chieu, va ghi nguoc chieu la loi lap trinh chu khong phai du lieu la.
 */
export function isValidSign(type: InventoryTransactionType, quantityChange: number): boolean {
  switch (type) {
    case InventoryTransactionType.PURCHASE:
      return quantityChange > 0;
    case InventoryTransactionType.SALE:
    case InventoryTransactionType.DISPENSE:
    case InventoryTransactionType.DAMAGED:
    case InventoryTransactionType.EXPIRED:
    case InventoryTransactionType.LOSS:
      return quantityChange < 0;
    case InventoryTransactionType.ADJUSTMENT:
    case InventoryTransactionType.RETURN:
      return quantityChange !== 0;
  }
}
