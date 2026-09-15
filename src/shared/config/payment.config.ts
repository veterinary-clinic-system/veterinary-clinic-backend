import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  provider: process.env.PAYMENT_PROVIDER ?? 'manual',

  vnpay: {
    tmnCode: process.env.VNPAY_TMN_CODE,
    hashSecret: process.env.VNPAY_HASH_SECRET,
    payUrl: process.env.VNPAY_PAY_URL ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: process.env.VNPAY_RETURN_URL ?? 'http://localhost:5173/thanh-toan/ket-qua',
  },

  sepay: {
    accountNumber: process.env.SEPAY_ACCOUNT_NUMBER,

    bankCode: process.env.SEPAY_BANK_CODE,
    apiKey: process.env.SEPAY_API_KEY,
    qrEndpoint: process.env.SEPAY_QR_ENDPOINT ?? 'https://vietqr.app/img',

    transferPrefix: process.env.SEPAY_TRANSFER_PREFIX ?? 'VETCARE',
  },
}));
