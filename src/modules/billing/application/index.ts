/**
 * API cong khai cua bounded context `billing`.
 *
 * Module khac CHI duoc import tu day (hoac tu `domain/entities`) - quy tac Phan III tai
 * lieu kien truc, duoc ESLint `import/no-restricted-paths` chan cung.
 *
 * Be mat nay co CHU DICH chi phoi ra `PaymentsService`: POS (P8-T5) can mot cua duy nhat
 * de ghi tien thu duoc, y het cach `catalog/application` chi phoi ra `InventoryService`
 * cho viec tru kho. `BillingService` KHONG nam o day - lap hoa don kham la viec noi bo
 * cua billing, va POS tu lap hoa don ban le cua no trong cung transaction voi viec tru
 * kho (khong the goi qua mot service khac ma van giu duoc mot transaction).
 */
export { PaymentsService } from './payments.service';
export type { InvoiceBalance, RecordPaymentParams } from './payments.service';
