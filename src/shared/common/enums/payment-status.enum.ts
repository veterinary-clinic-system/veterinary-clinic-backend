
export enum PaymentStatus {
  
  PENDING = 'PENDING',
  
  SUCCESS = 'SUCCESS',
  
  FAILED = 'FAILED',
  
  REFUNDED = 'REFUNDED',
}

export const SETTLED_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.SUCCESS,
  PaymentStatus.REFUNDED,
];
