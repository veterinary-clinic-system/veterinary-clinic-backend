

export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  
  format: 'currency' | 'count';
  
  deltaRatio: number | null;
  
  link?: string;
}

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
  
  generatedAt: string;
  branchId: string | null;
  kpis: DashboardKpi[];
  charts: DashboardSeries[];
}
