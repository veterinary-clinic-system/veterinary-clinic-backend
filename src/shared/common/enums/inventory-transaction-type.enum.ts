
export enum InventoryTransactionType {
  
  PURCHASE = 'PURCHASE',
  
  SALE = 'SALE',
  
  DISPENSE = 'DISPENSE',
  
  DAMAGED = 'DAMAGED',
  
  EXPIRED = 'EXPIRED',
  
  ADJUSTMENT = 'ADJUSTMENT',
  
  LOSS = 'LOSS',
  
  RETURN = 'RETURN',
}

export enum InventoryReferenceType {
  GOODS_RECEIPT = 'GOODS_RECEIPT',
  INVOICE = 'INVOICE',
  PRESCRIPTION = 'PRESCRIPTION',
  
  VACCINATION = 'VACCINATION',
  STOCK_TAKE = 'STOCK_TAKE',
  
  MANUAL = 'MANUAL',
}

export const ISSUE_TRANSACTION_TYPES: readonly InventoryTransactionType[] = [
  InventoryTransactionType.SALE,
  InventoryTransactionType.DISPENSE,
  InventoryTransactionType.DAMAGED,
  InventoryTransactionType.EXPIRED,
  InventoryTransactionType.LOSS,
  InventoryTransactionType.RETURN,
];
