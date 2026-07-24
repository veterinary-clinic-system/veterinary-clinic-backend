import { PriorityColor } from '@/common/enums/priority-color.enum';

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
