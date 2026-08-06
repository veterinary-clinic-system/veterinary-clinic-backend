import { PriorityColor } from '@/shared/common/enums/priority-color.enum';

/** One bucket of `GET /reports/revenue`, chronologically ordered. */
export interface RevenueByPeriod {
  /** `YYYY-MM-DD` when `groupBy=day`, `YYYY-MM` when `groupBy=month`. */
  period: string;
  totalRevenue: number;
  invoiceCount: number;
}

/** One row of `GET /reports/revenue/by-service`, ordered by `totalRevenue` descending. */
export interface RevenueByService {
  serviceName: string;
  totalRevenue: number;
  count: number;
}

/** One row of `GET /reports/revenue/by-doctor`, ordered by `totalRevenue` descending. */
export interface RevenueByDoctor {
  doctorId: string;
  doctorName: string;
  totalRevenue: number;
  appointmentCount: number;
}

/** One row of `GET /reports/exam-volume-by-disease-group`, ordered by `count` descending. */
export interface ExamVolumeByDiseaseGroup {
  diseaseGroup: string;
  count: number;
}

/** Per-triage-color accepted/overridden split within the `GET /reports/ai-accuracy` response. */
export interface AiAccuracyByColor {
  aiPriorityColor: PriorityColor;
  acceptedCount: number;
  overriddenCount: number;
}

/**
 * `GET /reports/ai-accuracy` response. "Accepted" = `Appointment.priorityColor` still
 * matches `PreScreeningResult.aiPriorityColor`; "Overridden" = staff changed it (this
 * also counts an appointment whose `priorityColor` was left `null` as overridden, since
 * null !== the AI's non-null suggestion - see ReportsService.getAiAccuracy).
 */
export interface AiAccuracyReport {
  totalEvaluated: number;
  accepted: number;
  overridden: number;
  /** `accepted / totalEvaluated`, in the range [0, 1]; `0` when `totalEvaluated` is `0`. */
  acceptanceRate: number;
  breakdownByColor: AiAccuracyByColor[];
}

// ------------------------------------------------------- Bao cao van hanh (P10-T4)

/**
 * `GET /reports/revenue/summary` - sau con so cua SRS muc 19.
 *
 * Doc tu bang `payments` (tien THUC THU), khac `RevenueByPeriod` doc tu `invoice_items`
 * (gia tri da BAN). Xem ghi chu dau `OperationalReportsService`.
 */
export interface RevenueSummaryReport {
  /** Da thu rong = SUCCESS + REFUNDED (dong hoan mang so am). */
  totalRevenue: number;
  totalPaid: number;
  /** So duong - tri tuyet doi cua tong cac dong hoan tien. */
  totalRefunded: number;
  /** Con phai thu cua cac hoa don lap trong ky. */
  totalUnpaid: number;
  invoiceCount: number;
  unpaidInvoiceCount: number;
}

/** `GET /reports/inventory` - anh chup kho tai thoi diem doc, khong theo khoang ngay. */
export interface InventoryReport {
  totalProducts: number;
  totalMedicines: number;
  totalVaccines: number;
  lowStock: number;
  outOfStock: number;
  expiringSoon: number;
  expired: number;
  /** Nguong dang dung cho `expiringSoon`, de giao dien ghi dung nhan. */
  expiringSoonDays: number;
}

/** Mot dong cua `GET /reports/sales`, ban chay nhat truoc. */
export interface SalesReportRow {
  itemCode: string;
  itemName: string;
  itemType: string;
  quantitySold: number;
  totalRevenue: number;
}

/** Mot bac si trong bang `GET /reports/exams`. */
export interface TopVeterinarian {
  doctorId: string;
  doctorName: string;
  examCount: number;
  noShowCount: number;
}

/** `GET /reports/exams` - bo sung No-show va Top Veterinarians cho bao cao kham. */
export interface ExamSummaryReport {
  totalAppointments: number;
  completed: number;
  noShow: number;
  cancelled: number;
  /** `noShow / totalAppointments`, trong khoang [0, 1]. */
  noShowRate: number;
  topVeterinarians: TopVeterinarian[];
}
