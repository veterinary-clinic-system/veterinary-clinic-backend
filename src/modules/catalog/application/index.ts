
export { InventoryService } from './inventory.service';
export type { AdjustStockParams, IssueStockParams, ReceiveStockParams } from './inventory.service';
export {
  InsufficientStockError,
  availableQuantity,
  isExpired,
} from '@/modules/catalog/domain/inventory-allocation.util';
export type {
  AllocatableBatch,
  BatchAllocation,
} from '@/modules/catalog/domain/inventory-allocation.util';
