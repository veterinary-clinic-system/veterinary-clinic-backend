import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
import { Diagnosis } from '@/modules/clinical/domain/entities/diagnosis.entity';
import { PreScreeningResult } from '@/modules/triage/domain/entities/pre-screening-result.entity';
import { ReportsController } from '@/modules/reporting/presentation/reports.controller';
import { ReportsService } from '@/modules/reporting/application/reports.service';
import { DashboardService } from '@/modules/reporting/application/dashboard.service';
import { OperationalReportsService } from '@/modules/reporting/application/operational-reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceItem, Diagnosis, PreScreeningResult])],
  controllers: [ReportsController],

  providers: [ReportsService, DashboardService, OperationalReportsService],
  exports: [ReportsService, DashboardService, OperationalReportsService],
})
export class ReportingModule {}
