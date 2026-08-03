import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  /**
   * Chon adapter cho port PaymentProvider: 'manual' (mac dinh - le tan thu tien tai
   * quay) hoac 'vnpay' (chuyen huong sang cong thanh toan).
   */
  provider: process.env.PAYMENT_PROVIDER ?? 'manual',

  vnpay: {
    tmnCode: process.env.VNPAY_TMN_CODE,
    hashSecret: process.env.VNPAY_HASH_SECRET,
    payUrl: process.env.VNPAY_PAY_URL ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: process.env.VNPAY_RETURN_URL ?? 'http://localhost:5173/thanh-toan/ket-qua',
  },
}));
