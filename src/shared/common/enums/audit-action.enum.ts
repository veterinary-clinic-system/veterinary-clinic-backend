/**
 * Muoi loai hanh dong duoc ghi nhat ky - SRS FR-26, BR-17 (P10-T1).
 *
 * Danh sach nay LA HOP DONG voi SRS, khong phai mot tap mo. Them mot loai moi nghia la
 * SRS doi; con mot hanh dong khong roi vao loai nao trong muoi loai nay thi gan nhu chac
 * chan no la mot trong muoi cai da co duoi ten khac (vi du "khoa tai khoan" la `UPDATE`
 * tren `User`, khong phai mot loai rieng).
 *
 * `CREATE`/`UPDATE`/`DELETE` la ba loai chung; bay loai con lai la nhung nghiep vu ma
 * kiem toan vien HOI DICH DANH ("ai da hoan tien don nay", "ai chinh ton kho thang
 * truoc") - gop chung vao `UPDATE` thi cau hoi do tra loi duoc nhung phai loc tay qua
 * hang nghin dong.
 */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  /** Xac nhan lich hen, duyet don dat hang. */
  APPROVE = 'APPROVE',
  /** Huy lich hen, huy hoa don, huy don thuoc. */
  CANCEL = 'CANCEL',
  /** Thu tien va hoan tien - hai chieu cua cung mot loai. */
  PAYMENT = 'PAYMENT',
  /** Cap phat thuoc (P7) va tiem vaccine (P9) - hai duong xuat kho co ho so y te. */
  DISPENSE = 'DISPENSE',
  /** Dieu chinh ton kho, kiem ke (P6). */
  STOCK_ADJUSTMENT = 'STOCK_ADJUSTMENT',
}
