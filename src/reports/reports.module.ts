import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Examination, InvoiceItem, PreScreeningResult } from '@/database/entities';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

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
export class ReportsModule {}
