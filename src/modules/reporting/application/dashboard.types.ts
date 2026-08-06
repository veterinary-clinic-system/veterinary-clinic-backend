/**
 * Hinh dang du lieu cua dashboard - SRS FR-24 (P10-T3).
 *
 * Tach khoi `reports.types.ts` vi hai thu phuc vu hai cau hoi khac nhau: bao cao tra loi
 * "thang truoc the nao" tren mot khoang ngay tuy chon, con dashboard tra loi "HOM NAY
 * dang the nao" - so lieu chot cua ngay hien tai, khong tham so hoa duoc.
 */

/** Mot the KPI. `delta` la ty le doi so voi ky truoc, `null` khi khong so sanh duoc. */
export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  /** `currency` de giao dien dinh dang tien; `count` la so dem tran. */
  format: 'currency' | 'count';
  /**
   * Thay doi so voi CUNG KY LIEN TRUOC (hom qua voi cac chi so theo ngay). `null` khi ky
   * truoc bang 0 - chia cho 0 khong ra "tang vo han", no ra "khong so sanh duoc", va hien
   * mot mui ten tang vot o do la noi doi.
   */
  deltaRatio: number | null;
  /** Duong dan man hinh chi tiet, de bam vao the la di duoc toi noi. */
  link?: string;
}

/** Mot diem tren bieu do duong/cot cua dashboard. */
export interface DashboardSeriesPoint {
  label: string;
  value: number;
}

export interface DashboardSeries {
  key: string;
  title: string;
  format: 'currency' | 'count';
  points: DashboardSeriesPoint[];
}

export interface DashboardResponse {
  /** Moc sinh so lieu - de giao dien noi ro du lieu cu toi dau khi doc tu cache. */
  generatedAt: string;
  branchId: string | null;
  kpis: DashboardKpi[];
  charts: DashboardSeries[];
}
