import PDFDocument from 'pdfkit';
import { join } from 'path';

import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Payment } from '@/modules/billing/domain/entities/payment.entity';

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} VND`;

const cleanText = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();

export function renderInvoiceReceiptPdf(
  doc: InstanceType<typeof PDFDocument>,
  invoice: Invoice,
  payments: Payment[],
): void {
  doc.registerFont('VetUnicode', join(__dirname, 'Arial.ttf')).font('VetUnicode');
  doc.fontSize(18).text(cleanText(invoice.branch?.branchName ?? 'VETAI HUB'), {
    align: 'center',
  });
  doc.fontSize(11).text('BIÊN LAI THANH TOÁN', { align: 'center' });
  if (invoice.branch?.address) {
    doc.fontSize(9).fillColor('gray').text(invoice.branch.address, { align: 'center' });
  }
  doc.fillColor('black').moveDown(1.5);

  doc.fontSize(11).text(`Mã hóa đơn: ${invoice.invoiceCode}`);
  doc.text(
    `Thanh toán lúc: ${invoice.paidAt ? new Date(invoice.paidAt).toLocaleString('vi-VN') : '-'}`,
  );
  doc.text(`Khách hàng: ${cleanText(invoice.customer?.fullName ?? 'Khách vãng lai')}`);
  doc.moveDown();

  doc.fontSize(12).text('Nội dung hóa đơn', { underline: true });
  for (const item of invoice.items ?? []) {
    doc
      .fontSize(10)
      .text(
        `${cleanText(item.item?.itemName ?? item.itemId)}  ×${item.quantity}  ${money(item.price * item.quantity)}`,
      );
  }

  doc.moveDown();
  doc.fontSize(10).text(`Tạm tính: ${money(invoice.subtotal)}`, { align: 'right' });
  if (invoice.discountAmount) {
    doc.text(`Giảm giá: -${money(invoice.discountAmount)}`, { align: 'right' });
  }
  if (invoice.taxAmount) {
    doc.text(`Thuế: ${money(invoice.taxAmount)}`, { align: 'right' });
  }
  doc.fontSize(13).text(`TỔNG ĐÃ THANH TOÁN: ${money(invoice.totalAmount)}`, {
    align: 'right',
  });
  doc.moveDown();

  doc.fontSize(10).text('Tham chiếu thanh toán:');
  payments
    .filter((payment) => payment.status === 'SUCCESS')
    .forEach((payment) => doc.text(`${payment.method} - ${payment.referenceCode ?? payment.id}`));
  doc
    .moveDown(2)
    .fontSize(9)
    .fillColor('gray')
    .text('Biên lai được phát hành điện tử bởi VETAI HUB.', { align: 'center' });
}
