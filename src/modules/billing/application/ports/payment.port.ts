import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';

/**
 * Port `PaymentProvider` - Phan III tai lieu kien truc.
 *
 * Ly do trung tuong hoa: cong thanh toan thay doi theo hop dong cua phong kham
 * (VNPay hom nay, MoMo nam sau), va phan lon giao dich o phong kham thu y van la
 * tien mat thu tai quay - khong the bat luong nghiep vu phu thuoc vao mot cong cu the.
 *
 * Hai adapter:
 *   - ManualPaymentAdapter : le tan thu tien tai quay roi danh dau da thu (mac dinh)
 *   - VnpayPaymentAdapter  : tao URL thanh toan va doi chieu ket qua tra ve
 */

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentRequest {
  invoiceId: string;
  /** So tien tinh bang DONG (so nguyen) - xem Phan V.4 quyet dinh #2. */
  amount: number;
  method: PaymentMethod;
  /** Ma hoa don doc duoc, dung lam noi dung chuyen khoan. */
  invoiceCode?: string;
}

export interface PaymentResult {
  /** true khi tien da thuc su duoc ghi nhan; false khi con cho nguoi dung thanh toan. */
  settled: boolean;
  /** URL de chuyen huong nguoi dung sang cong thanh toan; null voi thu tien mat. */
  redirectUrl: string | null;
  /** Ma giao dich phia cong thanh toan, luu de doi soat. */
  providerTransactionId: string | null;
}

export interface PaymentProvider {
  charge(request: PaymentRequest): Promise<PaymentResult>;
}
