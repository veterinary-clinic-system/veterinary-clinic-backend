/**
 * Vong doi cua mot ho so benh an - SRS FR-08 / BR-08.
 *
 * Chi HAI trang thai, khong nhieu hon: `DRAFT` la luc bac si dang kham va con go
 * duoc, `COMPLETED` la luc phieu da chot. BR-08 bao ve dung ranh gioi nay - ho so da
 * hoan tat khong sua duoc nua (muon sua phai di qua duong co ghi audit log, mo o P10).
 *
 * KHONG co trang thai "CANCELLED": mot lan kham da mo ho so ma khong ket thuc thi ho
 * so o lai `DRAFT` - do la su that, khong phai mot trang thai rieng.
 */
export enum MedicalRecordStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
}

/** Muc do nang cua mot chan doan - SRS FR-09. */
export enum DiagnosisSeverity {
  MILD = 'MILD',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
  CRITICAL = 'CRITICAL',
}
