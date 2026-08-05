/**
 * Vong doi mot gio hang POS - SRS FR-19.
 *
 * ```
 * OPEN ──→ CHECKED_OUT   (da thanh toan, sinh ra hoa don)
 *   │
 *   └──→ ABANDONED       (bo do - cron don sau 24h)
 * ```
 *
 * Hai trang thai cuoi deu KHONG lui duoc: `CHECKED_OUT` di kem mot hoa don va cac dong
 * so cai kho bat bien, con `ABANDONED` chi la don dep. Muon ban tiep thi mo gio moi.
 */
export enum CartStatus {
  /** Dang ban - dong duy nhat con sua duoc dong hang. */
  OPEN = 'OPEN',
  /** Da thanh toan xong (P8-T5). Gio tro thanh chung tu goc cua hoa don POS. */
  CHECKED_OUT = 'CHECKED_OUT',
  /** Bo do qua lau, cron danh dau de man hinh POS khong con thay (P8-T4). */
  ABANDONED = 'ABANDONED',
}
