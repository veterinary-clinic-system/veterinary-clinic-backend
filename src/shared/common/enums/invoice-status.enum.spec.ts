import { InvoiceStatus, deriveInvoiceStatus } from './invoice-status.enum';

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

  it('hoa don 0 dong -> PAID ngay, khong can dong thanh toan nao', () => {
    expect(deriveInvoiceStatus({ ...base, totalAmount: 0, netPaidAmount: 0 })).toBe(
      InvoiceStatus.PAID,
    );
  });

  it('co dong hoan tien -> REFUNDED du tong da thu ve 0', () => {
    expect(deriveInvoiceStatus({ ...base, netPaidAmount: 0, hasRefund: true })).toBe(
      InvoiceStatus.REFUNDED,
    );
  });

  it('da huy -> CANCELLED, khong bi ghi de boi phep suy theo tien', () => {
    expect(deriveInvoiceStatus({ ...base, isCancelled: true, netPaidAmount: 500_000 })).toBe(
      InvoiceStatus.CANCELLED,
    );
    expect(deriveInvoiceStatus({ ...base, isCancelled: true, hasRefund: true })).toBe(
      InvoiceStatus.CANCELLED,
    );
  });
});
