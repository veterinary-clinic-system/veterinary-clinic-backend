/**
 * Trang thai phieu kiem ke - SRS FR-18-03.
 *
 * Chi ba trang thai. Khong co "dang dem" rieng: `DRAFT` da la dang dem, va them mot
 * trang thai chi de danh dau "da bat dau go so" khong thay doi hanh vi nao ca.
 */
export enum StockTakeStatus {
  /** Dang dem, dang nhap so. Sua thoai mai. */
  DRAFT = 'DRAFT',
  /** Da xac nhan - ton da duoc dieu chinh va so cai da ghi. Khoa vinh vien. */
  CONFIRMED = 'CONFIRMED',
  /** Huy phieu. Khong dieu chinh gi ca. */
  CANCELLED = 'CANCELLED',
}
