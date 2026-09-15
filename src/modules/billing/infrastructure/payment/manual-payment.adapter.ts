import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
} from '@/modules/billing/application/ports/payment.port';

@Injectable()
export class ManualPaymentAdapter implements PaymentProvider {
  charge(request: PaymentRequest): Promise<PaymentResult> {
    return Promise.resolve({
      settled: true,
      redirectUrl: null,
      providerTransactionId: `manual:${request.invoiceId}`,
    });
  }
}
