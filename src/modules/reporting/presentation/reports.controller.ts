import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { ReportsService } from '@/modules/reporting/application/reports.service';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { RevenueFilterQueryDto } from './dto/revenue-filter-query.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';

/**
 * Read-only reporting/analytics dashboard for management - all routes are an
 * ADMIN/RECEPTIONIST capability (Section 4.1.5-style "statistics" screens), never
 * exposed to Doctor or PetOwner accounts.
 */
@ApiTags('reports')
@Roles(Role.ADMIN, Role.RECEPTIONIST)
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
