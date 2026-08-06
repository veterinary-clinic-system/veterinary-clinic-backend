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

/**
 * Bao cao/thong ke chi doc danh cho quan ly.
 *
 * SUA MOT LOI PHAN QUYEN: truoc day la `@Roles(Role.ADMIN, Role.RECEPTIONIST)`, tuc la
 * le tan xem duoc toan bo doanh thu. BR-15 cua SRS noi ro "Chi Manager/Admin duoc xem
 * bao cao doanh thu". Nay chuyen sang `REPORT_VIEW`, va trong ma tran mac dinh chi
 * ADMIN va MANAGER co quyen do.
 */
@ApiTags('reports')
@RequirePermissions(Permission.REPORT_VIEW)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly dashboardService: DashboardService,
    private readonly operationalReportsService: OperationalReportsService,
  ) {}

  /**
   * Dashboard dieu hanh - FR-24 (P10-T3).
   *
   * Nam trong `ReportsController` nen no thua `@RequirePermissions(REPORT_VIEW)` cua ca
   * lop: BR-15 (chi Manager/Admin xem so lieu doanh thu) ap dung nguyen ven cho dashboard,
   * vi the KPI dau tien cua no la doanh thu hom nay.
   */
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

  /** Sau con so cua SRS muc 19, doc tu `payments` - tien THUC THU (P10-T4). */
  @Get('revenue/summary')
  getRevenueSummary(@Query() query: ReportFilterDto) {
    return this.operationalReportsService.getRevenueSummary(query);
  }

  /** Anh chup kho tai thoi diem doc - khong nhan khoang ngay, xem service de ro ly do. */
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

  /**
   * Xuat CSV cho bao cao ban hang - muc 12 SRS khong doi, nhung khong xuat duoc file thi
   * khong demo duoc, va do la thu dau tien nguoi cham do an bam vao.
   *
   * CSV chu khong Excel that: mot file `.xlsx` can them thu vien va mot dinh dang nhi
   * phan, doi lai duoc dung mot thu la dinh dang o. Excel mo CSV truc tiep.
   *
   * BOM UTF-8 o dau file la BAT BUOC: khong co no, Excel tren Windows doc `Cà phê` thanh
   * `CÃ  phÃª`. Day la loi mac dinh se gap ngay lan xuat dau tien.
   */
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
