/**
 * Nguon sinh ra mot hoa don - P8-T1.
 *
 * Truoc P8 moi hoa don deu tu mot lich hen ma ra, nen `invoices.appointment_id` la NOT
 * NULL va cot do dong thoi dong vai tro "loai hoa don". POS ban cho khach vang lai
 * khong co lich hen nao, nen hai vai tro do phai tach: `appointment_id` tro ve dung
 * nghia "lien ket toi lan kham", con cot nay moi la thu phan loai.
 *
 * Vi sao khong suy ra tu `appointment_id IS NULL`: bao cao doanh thu (P10) va man hinh
 * hoa don loc theo nguon rat nhieu; loc tren mot cot enum co chi muc thi ro rang va
 * nhanh hon suy dien tu mot cot khoa ngoai, va neu sau nay co nguon thu ba (don online
 * chang han) thi khong phai viet lai moi cho loc.
 */
export enum InvoiceSource {
  /** Hoa don kham - sinh tu mot lich hen (`appointment_id` luon co gia tri). */
  CLINIC = 'CLINIC',
  /** Ban le tai quay - sinh tu mot gio hang POS (`appointment_id` luon NULL). */
  POS = 'POS',
}
