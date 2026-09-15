import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { ReportsService } from '@/modules/reporting/application/reports.service';
import { DashboardService } from '@/modules/reporting/application/dashboard.service';
import { OperationalReportsService } from '@/modules/reporting/application/operational-reports.service';
import { toCsv } from '@/modules/reporting/application/csv.util';
import { ReportFilterDto } from './dto/report-filter.dto';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { RevenueFilterQueryDto } from './dto/revenue-filter-query.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';

@ApiTags('reports')
@RequirePermissions(Permission.REPORT_VIEW)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly dashboardService: DashboardService,
    private readonly operationalReportsService: OperationalReportsService,
  ) {}

  @Get('dashboard')
  getDashboard(@Query('branchId') branchId?: string) {
    return this.dashboardService.getDashboard(branchId || undefined);
  }

  @Get('revenue')
  getRevenue(@Query() query: RevenueQueryDto) {
    return this.reportsService.getRevenue(query);
  }

  @Get('revenue/by-service')
  getRevenueByService(@Query() query: RevenueFilterQueryDto) {
    return this.reportsService.getRevenueByService(query);
  }

  @Get('revenue/by-doctor')
  getRevenueByDoctor(@Query() query: RevenueFilterQueryDto) {
    return this.reportsService.getRevenueByDoctor(query);
  }

  @Get('revenue/summary')
  getRevenueSummary(@Query() query: ReportFilterDto) {
    return this.operationalReportsService.getRevenueSummary(query);
  }

  @Get('inventory')
  getInventoryReport(@Query('branchId') branchId?: string) {
    return this.operationalReportsService.getInventoryReport(branchId || undefined);
  }

  @Get('sales')
  getSalesReport(@Query() query: ReportFilterDto) {
    return this.operationalReportsService.getSalesReport(query);
  }

  @Get('exams')
  getExamSummary(@Query() query: DateRangeQueryDto) {
    return this.operationalReportsService.getExamSummary(query);
  }

  @Get('sales/export')
  async exportSalesReport(@Query() query: ReportFilterDto, @Res() res: Response): Promise<void> {
    const rows = await this.operationalReportsService.getSalesReport(query);
    const csv = toCsv(
      ['Mã hàng', 'Tên hàng', 'Loại', 'Số lượng bán', 'Doanh thu'],
      rows.map((row) => [
        row.itemCode,
        row.itemName,
        row.itemType,
        row.quantitySold,
        row.totalRevenue,
      ]),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bao-cao-ban-hang-${query.from}-${query.to}.csv"`,
    );
    res.send(csv);
  }

  @Get('exam-volume-by-disease-group')
  getExamVolumeByDiseaseGroup(@Query() query: DateRangeQueryDto) {
    return this.reportsService.getExamVolumeByDiseaseGroup(query);
  }

  @Get('ai-accuracy')
  getAiAccuracy(@Query() query: DateRangeQueryDto) {
    return this.reportsService.getAiAccuracy(query);
  }
}
