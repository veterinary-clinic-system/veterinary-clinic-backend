/**
 * Phuong thuc thanh toan - diagram.jpg <<enumeration>> PaymentMethod, mo rong o P8-T2.
 *
 * ANH XA SANG SRS: SRS muc 15 goi the ngan hang la `CARD`, codebase goi la
 * `CREDIT_CARD` - CUNG MOT THU. Giu ten cu thay vi doi theo SRS vi doi nghia la migration
 * enum + backfill `invoices.payment_method` + sua ca FE, doi lay dung mot cai ten khac;
 * day cung la lua chon "Hybrid" da chot o `docs/plan/README.md`.
 */
export enum PaymentMethod {
  CASH = 'CASH',
  E_WALLET = 'E_WALLET',
  /** = `CARD` cua SRS: the tin dung/ghi no quet tai quay. */
  CREDIT_CARD = 'CREDIT_CARD',
  /** Chuyen khoan ngan hang - doi soat qua `payments.reference_code` (P8-T2). */
  BANK_TRANSFER = 'BANK_TRANSFER',
  /** Quet ma QR (VietQR/VNPay QR) - khac vi dien tu o cho tien ve thang tai khoan. */
  QR = 'QR',
}
