import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
} from '@/modules/billing/application/ports/payment.port';
import { SepayService } from '@/modules/billing/application/sepay.service';

@Injectable()
export class SepayPaymentAdapter implements PaymentProvider {
  constructor(private readonly sepayService: SepayService) {}

  async charge(request: PaymentRequest): Promise<PaymentResult> {
    const ticket = await this.sepayService.createQrTicket(request.invoiceId, request.amount);
    return {
      settled: false,
      redirectUrl: ticket.qrImageUrl,
      providerTransactionId: ticket.transferContent,
    };
  }
}
