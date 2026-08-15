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

  /**
   * SePay - dich vu doc bien dong so du tai khoan ngan hang roi goi webhook ve he thong.
   *
   * Khac VNPay o cho KHONG co trang chuyen huong: khach quet ma VietQR va chuyen khoan
   * bang ung dung ngan hang cua ho, tien ve thang tai khoan phong kham. Ta chi cho
   * webhook bao "co tien vao voi noi dung X" roi doi chieu X voi ma hoa don.
   *
   * `apiKey` la bi mat DUY NHAT bao ve webhook (SePay gui trong header
   * `Authorization: Apikey <key>`). Khong dat gia tri mac dinh: thieu cau hinh thi
   * webhook tu tu choi moi request thay vi chap nhan mot khoa doan duoc.
   */
  sepay: {
    accountNumber: process.env.SEPAY_ACCOUNT_NUMBER,
    /** Ma ngan hang theo VietQR, vi du 'MBBank', 'Vietcombank', 'TPBank'. */
    bankCode: process.env.SEPAY_BANK_CODE,
    apiKey: process.env.SEPAY_API_KEY,
    qrEndpoint: process.env.SEPAY_QR_ENDPOINT ?? 'https://qr.sepay.vn/img',
    /**
     * Tien to cua noi dung chuyen khoan. SePay doi chieu giao dich bang cach tim chuoi
     * `<prefix><ma hoa don>` trong noi dung, nen no phai la chuoi chu-so khong dau va
     * du hiem de khong dinh nham mot giao dich khac.
     */
    transferPrefix: process.env.SEPAY_TRANSFER_PREFIX ?? 'VETCARE',
  },
}));
