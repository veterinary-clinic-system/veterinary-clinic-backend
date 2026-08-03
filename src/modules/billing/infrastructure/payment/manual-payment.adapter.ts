import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
} from '@/modules/billing/application/ports/payment.port';

/**
 * Adapter mac dinh: le tan thu tien (mat / quet the / vi dien tu) NGAY TAI QUAY roi
 * danh dau hoa don da thanh toan. Khong goi ra ngoai, nen giao dich duoc coi la
 * ket thuc ngay (`settled: true`).
 *
 * Day khong phai adapter "gia" cho du - da so phong kham thu y vua va nho van thu
 * tien mat, nen day chinh la duong di chinh trong thuc te.
 */
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
