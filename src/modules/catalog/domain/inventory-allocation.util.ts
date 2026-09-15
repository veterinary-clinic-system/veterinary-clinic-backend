import { InventoryTransactionType } from '@/shared/common/enums/inventory-transaction-type.enum';

export interface AllocatableBatch {
  id: string;
  batchNo: string;
  
  expiryDate: string | null;
  quantity: number;
  receivedAt: Date;
}

export interface BatchAllocation {
  batchId: string;
  batchNo: string;
  quantity: number;
}

export interface PlannedLedgerLine {
  batchId: string | null;
  quantityChange: number;
  quantityAfter: number;
}

export class InsufficientStockError extends Error {
  constructor(
    readonly requested: number,
    readonly available: number,
  ) {
    super(`Khong du ton kho: can ${requested}, kha dung ${available}`);
    this.name = 'InsufficientStockError';
  }
}

export function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isExpired(batch: Pick<AllocatableBatch, 'expiryDate'>, today: string): boolean {
  return batch.expiryDate !== null && batch.expiryDate < today;
}

export function availableQuantity(batches: readonly AllocatableBatch[], today: string): number {
  return batches.reduce((sum, batch) => (isExpired(batch, today) ? sum : sum + batch.quantity), 0);
}

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
