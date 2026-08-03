import { createHmac } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
} from '@/modules/billing/application/ports/payment.port';

/**
 * Adapter VNPay - tao URL chuyen huong sang cong thanh toan.
 *
 * CANH BAO: phan ky HMAC-SHA512 duoi day duoc viet theo dac ta cong khai cua VNPay
 * nhung CHUA duoc doi chieu voi moi truong sandbox that (chua co ma TmnCode/HashSecret).
 * Phai chay thu tren sandbox VNPay truoc khi dung that. Ham `verifyReturn` de doi
 * soat ket qua tra ve cung nam o day de logic ky/xac minh khong bi tach roi.
 *
 * Luu y: `settled: false` - tien CHUA vao tai khoan tai thoi diem tao URL. Hoa don chi
 * duoc danh dau da thanh toan khi VNPay goi lai IPN va chu ky duoc xac minh.
 */
@Injectable()
export class VnpayPaymentAdapter implements PaymentProvider {
  constructor(private readonly configService: ConfigService) {}

  charge(request: PaymentRequest): Promise<PaymentResult> {
    const tmnCode = this.configService.get<string>('payment.vnpay.tmnCode');
    const hashSecret = this.configService.get<string>('payment.vnpay.hashSecret');
    const payUrl = this.configService.get<string>('payment.vnpay.payUrl')!;
    const returnUrl = this.configService.get<string>('payment.vnpay.returnUrl')!;

    if (!tmnCode || !hashSecret) {
      throw new InternalServerErrorException(
        'Chua cau hinh VNPAY_TMN_CODE / VNPAY_HASH_SECRET - khong the tao URL thanh toan',
      );
    }

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      // VNPay yeu cau so tien nhan 100 va la so nguyen.
      vnp_Amount: String(request.amount * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: request.invoiceCode ?? request.invoiceId,
      vnp_OrderInfo: `Thanh toan hoa don ${request.invoiceCode ?? request.invoiceId}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: '127.0.0.1',
      vnp_CreateDate: formatVnpDate(new Date()),
    };

    const query = buildSignedQuery(params, hashSecret);

    return Promise.resolve({
      settled: false,
      redirectUrl: `${payUrl}?${query}`,
      providerTransactionId: null,
    });
  }

  /**
   * Xac minh chu ky tren tham so VNPay tra ve (ca return-url lan IPN).
   * So sanh chu ky la buoc BAT BUOC: neu bo qua, bat ky ai cung co the goi return-url
   * voi trang thai thanh cong gia de danh dau hoa don da thanh toan.
   */
  verifyReturn(query: Record<string, string>): boolean {
    const hashSecret = this.configService.get<string>('payment.vnpay.hashSecret');
    if (!hashSecret) return false;

    const received = query['vnp_SecureHash'];
    const params = { ...query };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    const expected = signParams(params, hashSecret);
    return received?.toLowerCase() === expected.toLowerCase();
  }
}

/** VNPay yeu cau tham so duoc sap xep theo thu tu alphabet truoc khi ky. */
function sortedEncodedPairs(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&');
}

function signParams(params: Record<string, string>, hashSecret: string): string {
  return createHmac('sha512', hashSecret).update(sortedEncodedPairs(params), 'utf-8').digest('hex');
}

function buildSignedQuery(params: Record<string, string>, hashSecret: string): string {
  const data = sortedEncodedPairs(params);
  const secureHash = createHmac('sha512', hashSecret).update(data, 'utf-8').digest('hex');
  return `${data}&vnp_SecureHash=${secureHash}`;
}

/** VNPay dung dinh dang yyyyMMddHHmmss theo gio Viet Nam. */
function formatVnpDate(date: Date): string {
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${vn.getUTCFullYear()}${p(vn.getUTCMonth() + 1)}${p(vn.getUTCDate())}` +
    `${p(vn.getUTCHours())}${p(vn.getUTCMinutes())}${p(vn.getUTCSeconds())}`
  );
}
