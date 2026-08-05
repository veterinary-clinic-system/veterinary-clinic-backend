/**
 * API cong khai cua bounded context `catalog`.
 *
 * Module khac CHI duoc import tu day (hoac tu `domain/entities`), khong duoc voi tay
 * vao `infrastructure/` hay `presentation/` - quy tac Phan III tai lieu kien truc,
 * duoc ESLint `import/no-restricted-paths` chan cung.
 *
 * Be mat nay co CHU DICH chi phoi ra `InventoryService`: P7 (cap phat thuoc) va P8
 * (POS) can dung mot cua duy nhat de tru ton kho. Cac service danh muc con lai
 * (Items/Services/Medications/Products/Suppliers/Categories) chi phuc vu man hinh quan
 * tri cua chinh module nay - module khac can du lieu danh muc thi doc entity, khong goi
 * service. Mo rong barrel chi khi that su co module khac can, khong mo san.
 */
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
