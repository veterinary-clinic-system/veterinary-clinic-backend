import { PriorityColor } from '@/shared/common/enums/priority-color.enum';

export interface RevenueByPeriod {
  
  period: string;
  totalRevenue: number;
  invoiceCount: number;
}

export interface RevenueByService {
  serviceName: string;
  totalRevenue: number;
  count: number;
}

export interface RevenueByDoctor {
  doctorId: string;
  doctorName: string;
  totalRevenue: number;
  appointmentCount: number;
}

export interface ExamVolumeByDiseaseGroup {
  diseaseGroup: string;
  count: number;
}

export interface AiAccuracyByColor {
  aiPriorityColor: PriorityColor;
  acceptedCount: number;
  overriddenCount: number;
}

export interface AiAccuracyReport {
  totalEvaluated: number;
  accepted: number;
  overridden: number;
  
  acceptanceRate: number;
  breakdownByColor: AiAccuracyByColor[];
}

export interface RevenueSummaryReport {
  
  totalRevenue: number;
  totalPaid: number;
  
  totalRefunded: number;
  
  totalUnpaid: number;
  invoiceCount: number;
  unpaidInvoiceCount: number;
}

export interface InventoryReport {
  totalProducts: number;
  totalMedicines: number;
  totalVaccines: number;
  lowStock: number;
  outOfStock: number;
  expiringSoon: number;
  expired: number;
  
  expiringSoonDays: number;
}

export interface SalesReportRow {
  itemCode: string;
  itemName: string;
  itemType: string;
  quantitySold: number;
  totalRevenue: number;
}

export interface TopVeterinarian {
  doctorId: string;
  doctorName: string;
  examCount: number;
  noShowCount: number;
}

export interface ExamSummaryReport {
  totalAppointments: number;
  completed: number;
  noShow: number;
  cancelled: number;
  
  noShowRate: number;
  topVeterinarians: TopVeterinarian[];
}
