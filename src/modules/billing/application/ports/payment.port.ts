import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentRequest {
  invoiceId: string;
  
  amount: number;
  method: PaymentMethod;
  
  invoiceCode?: string;
}

export interface PaymentResult {
  
  settled: boolean;
  
  redirectUrl: string | null;
  
  providerTransactionId: string | null;
}

export interface PaymentProvider {
  charge(request: PaymentRequest): Promise<PaymentResult>;
}
