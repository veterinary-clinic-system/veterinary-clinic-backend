
export enum InvoiceStatus {
  
  PENDING = 'PENDING',
  
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  
  PAID = 'PAID',
  
  CANCELLED = 'CANCELLED',
  
  REFUNDED = 'REFUNDED',
}

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

export const LOCKED_INVOICE_STATUSES: ReadonlySet<InvoiceStatus> = new Set([
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.REFUNDED,
  InvoiceStatus.CANCELLED,
]);
