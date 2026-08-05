import { InvoiceStatus, deriveInvoiceStatus } from './invoice-status.enum';

/**
 * Trang thai hoa don duoc SUY ra tu so tien, khong dat tay - P8-T2.
 *
 * Test o day khang dinh dung phep suy do, vi no la cho duy nhat quyet dinh mot hoa don
 * "da thanh toan" hay chua. Sai o day thi bao cao doanh thu cua P10 sai theo ma khong co
 * dau hieu gi.
 */
describe('deriveInvoiceStatus', () => {
  const base = { totalAmount: 500_000, netPaidAmount: 0, hasRefund: false, isCancelled: false };

  it('chua thu dong nao -> PENDING', () => {
    expect(deriveInvoiceStatus(base)).toBe(InvoiceStatus.PENDING);
  });

  it('thu mot phan -> PARTIALLY_PAID', () => {
    expect(deriveInvoiceStatus({ ...base, netPaidAmount: 200_000 })).toBe(
      InvoiceStatus.PARTIALLY_PAID,
    );
  });

  it('thu du -> PAID', () => {
    expect(deriveInvoiceStatus({ ...base, netPaidAmount: 500_000 })).toBe(InvoiceStatus.PAID);
  });

  /**
   * Hoa don 0 dong (giam gia 100%, hang tang kem) khong co gi de thu nen PAID ngay.
   *
   * Neu de no roi vao `PENDING` thi ban hang giam gia 100% se ket lai: `PaymentsService`
   * tu choi ghi mot dong thanh toan 0 dong, nen khong con duong nao dua hoa don do ve
   * trang thai da xong.
   */
  it('hoa don 0 dong -> PAID ngay, khong can dong thanh toan nao', () => {
    expect(deriveInvoiceStatus({ ...base, totalAmount: 0, netPaidAmount: 0 })).toBe(
      InvoiceStatus.PAID,
    );
  });

  /**
   * Hoan tien THANG trang thai theo tien: sau khi hoan, tong da thu ve 0, nhung hoa don
   * KHONG duoc quay lai `PENDING` - no da ket thuc vong doi.
   */
  it('co dong hoan tien -> REFUNDED du tong da thu ve 0', () => {
    expect(deriveInvoiceStatus({ ...base, netPaidAmount: 0, hasRefund: true })).toBe(
      InvoiceStatus.REFUNDED,
    );
  });

  /** Huy thang moi thu con lai - hoa don huy chi huy duoc khi chua thu dong nao. */
  it('da huy -> CANCELLED, khong bi ghi de boi phep suy theo tien', () => {
    expect(deriveInvoiceStatus({ ...base, isCancelled: true, netPaidAmount: 500_000 })).toBe(
      InvoiceStatus.CANCELLED,
    );
    expect(deriveInvoiceStatus({ ...base, isCancelled: true, hasRefund: true })).toBe(
      InvoiceStatus.CANCELLED,
    );
  });
});
