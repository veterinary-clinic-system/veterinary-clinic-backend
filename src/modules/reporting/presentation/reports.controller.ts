import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { ReportsService } from '@/modules/reporting/application/reports.service';
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
  constructor(private readonly reportsService: ReportsService) {}

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

  @Get('exam-volume-by-disease-group')
  getExamVolumeByDiseaseGroup(@Query() query: DateRangeQueryDto) {
    return this.reportsService.getExamVolumeByDiseaseGroup(query);
  }

  @Get('ai-accuracy')
  getAiAccuracy(@Query() query: DateRangeQueryDto) {
    return this.reportsService.getAiAccuracy(query);
  }
}
