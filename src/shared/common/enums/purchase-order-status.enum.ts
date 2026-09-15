
export enum PurchaseOrderStatus {
  
  DRAFT = 'DRAFT',
  
  ORDERED = 'ORDERED',
  
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  
  RECEIVED = 'RECEIVED',
  
  CANCELLED = 'CANCELLED',
}

export const CLOSED_PURCHASE_ORDER_STATUSES: readonly PurchaseOrderStatus[] = [
  PurchaseOrderStatus.RECEIVED,
  PurchaseOrderStatus.CANCELLED,
];
