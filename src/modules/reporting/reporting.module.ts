import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
import { Examination } from '@/modules/clinical/domain/entities/examination.entity';
import { PreScreeningResult } from '@/modules/triage/domain/entities/pre-screening-result.entity';
import { ReportsController } from '@/modules/reporting/presentation/reports.controller';
import { ReportsService } from '@/modules/reporting/application/reports.service';

/**
 * Reporting/analytics module - entirely read-only aggregation queries over entities
 * other modules write to (billing's Invoice/InvoiceItem, examinations' Examination,
 * prescreening's PreScreeningResult, plus their Appointment/Doctor/Item relations), so
 * this only needs `TypeOrmModule.forFeature` registrations, never those modules'
 * services. `InvoiceItem` is the entry point for every revenue query (not `Invoice`)
 * since revenue is a sum of billed line items, not a single invoice total.
 */
@Module({
  imports: [TypeOrmModule.forFeature([InvoiceItem, Examination, PreScreeningResult])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportingModule {}
