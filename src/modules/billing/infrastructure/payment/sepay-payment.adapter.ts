import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
} from '@/modules/billing/application/ports/payment.port';
import { SepayService } from '@/modules/billing/application/sepay.service';

/**
 * Adapter SePay cho port `PaymentProvider` - de duong `PATCH /billing/invoices/:id/pay`
 * cu van dung duoc khi `PAYMENT_PROVIDER=sepay`.
 *
 * `settled: false` va `redirectUrl` la URL ANH ma QR (khong phai trang cong thanh toan
 * nhu VNPay): SePay khong co trang chuyen huong - khach quet ma bang ung dung ngan hang
 * cua ho. `BillingService.pay` nem `PaymentPendingException(redirectUrl)` va giao dien
 * hien anh do len.
 *
 * Man hinh hoa don nen goi thang `POST /billing/sepay/invoices/:id/qr` de con lay duoc
 * ca noi dung chuyen khoan va `paymentId` (dung de hoi trang thai); duong nay chi de
 * loi goi cu khong vo.
 */
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
