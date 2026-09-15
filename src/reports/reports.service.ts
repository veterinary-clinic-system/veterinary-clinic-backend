import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { Examination, InvoiceItem, PreScreeningResult } from '@/database/entities';
import { ItemType } from '@/common/enums/item-type.enum';
import { PRIORITY_COLOR_SEVERITY, PriorityColor } from '@/common/enums/priority-color.enum';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { RevenueFilterQueryDto } from './dto/revenue-filter-query.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import {
  AiAccuracyByColor,
  AiAccuracyReport,
  ExamVolumeByDiseaseGroup,
  RevenueByDoctor,
  RevenueByPeriod,
  RevenueByService,
} from './reports.types';

/**
 * Read-only aggregation queries over entities other modules own (Invoice/InvoiceItem,
 * Examination, PreScreeningResult/Appointment). Backs the ADMIN/RECEPTIONIST reporting
 * dashboard - nothing here writes to the database.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(InvoiceItem) private readonly invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Examination) private readonly examinationRepository: Repository<Examination>,
    @InjectRepository(PreScreeningResult)
    private readonly preScreeningResultRepository: Repository<PreScreeningResult>,
  ) {}

  /**
   * `GET /reports/revenue` - sums `price * quantity` of every line item on a `paid`
   * invoice, bucketed by the invoice's `paidAt` date (not the appointment date - revenue
   * is recognized when it's actually collected).
   */
  async getRevenue(query: RevenueQueryDto): Promise<RevenueByPeriod[]> {
    const fromDate = startOfDay(new Date(query.from));
    const toDate = endOfDay(new Date(query.to));
    this.assertValidRange(fromDate, toDate);

    const groupBy = query.groupBy ?? 'day';
    const dateFormat = groupBy === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
    // Raw column name (not the `paidAt` entity property) so the expression survives
    // untouched through TypeORM's alias.property -> "alias"."column" rewriting, which
    // only rewrites plain `alias.property` tokens, not ones buried inside a function call.
    const periodExpr = `TO_CHAR(invoice.paid_at, '${dateFormat}')`;

    const qb = this.invoiceItemRepository
      .createQueryBuilder('invoiceItem')
      .innerJoin('invoiceItem.invoice', 'invoice')
      .where('invoice.paid = :paid', { paid: true })
      .andWhere('invoice.paidAt >= :from', { from: fromDate })
      .andWhere('invoice.paidAt <= :to', { to: toDate });

    if (query.branchId) {
      qb.innerJoin('invoice.appointment', 'appointment').andWhere('appointment.branchId = :branchId', {
        branchId: query.branchId,
      });
    }

    const rows = await qb
      .select(periodExpr, 'period')
      .addSelect('SUM(invoiceItem.price * invoiceItem.quantity)', 'totalRevenue')
      .addSelect('COUNT(DISTINCT invoice.id)', 'invoiceCount')
      // Group/order by the expression itself (not the `period` alias) to sidestep
      // Postgres's case-folding of unquoted identifiers vs. TypeORM's quoted alias.
      .groupBy(periodExpr)
      .orderBy(periodExpr, 'ASC')
      .getRawMany<{ period: string; totalRevenue: string | null; invoiceCount: string }>();

    return rows.map((row) => ({
      period: row.period,
      totalRevenue: parseFloat(row.totalRevenue ?? '0') || 0,
      invoiceCount: parseInt(row.invoiceCount, 10),
    }));
  }

  /** `GET /reports/revenue/by-service` - paid `SERVICE`-type line items grouped by item, richest first. */
  async getRevenueByService(query: RevenueFilterQueryDto): Promise<RevenueByService[]> {
    const fromDate = startOfDay(new Date(query.from));
    const toDate = endOfDay(new Date(query.to));
    this.assertValidRange(fromDate, toDate);

    const qb = this.invoiceItemRepository
      .createQueryBuilder('invoiceItem')
      .innerJoin('invoiceItem.invoice', 'invoice')
      .innerJoin('invoiceItem.item', 'item')
      .where('invoice.paid = :paid', { paid: true })
      .andWhere('item.itemType = :itemType', { itemType: ItemType.SERVICE })
      .andWhere('invoice.paidAt >= :from', { from: fromDate })
      .andWhere('invoice.paidAt <= :to', { to: toDate });

    if (query.branchId) {
      qb.innerJoin('invoice.appointment', 'appointment').andWhere('appointment.branchId = :branchId', {
        branchId: query.branchId,
      });
    }

    const revenueExpr = 'SUM(invoiceItem.price * invoiceItem.quantity)';
    const rows = await qb
      .select('item.itemName', 'serviceName')
      .addSelect(revenueExpr, 'totalRevenue')
      .addSelect('COUNT(*)', 'count')
      .groupBy('item.id')
      .addGroupBy('item.itemName')
      .orderBy(revenueExpr, 'DESC')
      .getRawMany<{ serviceName: string; totalRevenue: string | null; count: string }>();

    return rows.map((row) => ({
      serviceName: row.serviceName,
      totalRevenue: parseFloat(row.totalRevenue ?? '0') || 0,
      count: parseInt(row.count, 10),
    }));
  }

  /** `GET /reports/revenue/by-doctor` - paid invoices grouped by the appointment's doctor, richest first. */
  async getRevenueByDoctor(query: RevenueFilterQueryDto): Promise<RevenueByDoctor[]> {
    const fromDate = startOfDay(new Date(query.from));
    const toDate = endOfDay(new Date(query.to));
    this.assertValidRange(fromDate, toDate);

    const qb = this.invoiceItemRepository
      .createQueryBuilder('invoiceItem')
      .innerJoin('invoiceItem.invoice', 'invoice')
      .innerJoin('invoice.appointment', 'appointment')
      .innerJoin('appointment.doctor', 'doctor')
      .where('invoice.paid = :paid', { paid: true })
      .andWhere('invoice.paidAt >= :from', { from: fromDate })
      .andWhere('invoice.paidAt <= :to', { to: toDate });

    if (query.branchId) {
      qb.andWhere('appointment.branchId = :branchId', { branchId: query.branchId });
    }

    const revenueExpr = 'SUM(invoiceItem.price * invoiceItem.quantity)';
    const rows = await qb
      .select('doctor.id', 'doctorId')
      .addSelect('doctor.fullName', 'doctorName')
      .addSelect(revenueExpr, 'totalRevenue')
      .addSelect('COUNT(DISTINCT invoice.id)', 'appointmentCount')
      .groupBy('doctor.id')
      .addGroupBy('doctor.fullName')
      .orderBy(revenueExpr, 'DESC')
      .getRawMany<{ doctorId: string; doctorName: string; totalRevenue: string | null; appointmentCount: string }>();

    return rows.map((row) => ({
      doctorId: row.doctorId,
      doctorName: row.doctorName,
      totalRevenue: parseFloat(row.totalRevenue ?? '0') || 0,
      appointmentCount: parseInt(row.appointmentCount, 10),
    }));
  }

  /**
   * `GET /reports/exam-volume-by-disease-group` - `Examination.diseaseGroups` is a text
   * array (a doctor can tag one exam with several groups), so counting "occurrences per
   * group" needs `unnest()` to expand it into one row per group before grouping.
   */
  async getExamVolumeByDiseaseGroup(query: DateRangeQueryDto): Promise<ExamVolumeByDiseaseGroup[]> {
    const fromDate = query.from ? startOfDay(new Date(query.from)) : undefined;
    const toDate = query.to ? endOfDay(new Date(query.to)) : undefined;
    this.assertValidRange(fromDate, toDate);

    const qb = this.examinationRepository
      .createQueryBuilder('examination')
      // Raw column name, same reasoning as the `TO_CHAR` expression above - `unnest(...)`
      // is a function call, so the `examination.property` auto-rewrite wouldn't apply to
      // whatever's inside it anyway; spelling out the real (snake_case) column sidesteps
      // any doubt.
      .select('unnest(examination.disease_groups)', 'diseaseGroup')
      .addSelect('COUNT(*)', 'count');

    if (query.branchId) {
      qb.innerJoin('examination.appointment', 'appointment').andWhere('appointment.branchId = :branchId', {
        branchId: query.branchId,
      });
    }
    if (fromDate) {
      qb.andWhere('examination.examinedAt >= :from', { from: fromDate });
    }
    if (toDate) {
      qb.andWhere('examination.examinedAt <= :to', { to: toDate });
    }

    // Quoted so it matches TypeORM's quoted `AS "diseaseGroup"` / `AS "count"` output
    // aliases exactly - an unquoted reference would Postgres-fold to lowercase and fail
    // to resolve against the mixed-case `"diseaseGroup"` alias.
    const rows = await qb
      .groupBy('"diseaseGroup"')
      .orderBy('"count"', 'DESC')
      .getRawMany<{ diseaseGroup: string; count: string }>();

    return rows.map((row) => ({ diseaseGroup: row.diseaseGroup, count: parseInt(row.count, 10) }));
  }

  /**
   * `GET /reports/ai-accuracy` - "accepted" vs. "overridden" is computed in application
   * code (not a SQL CASE) per the task spec, comparing each appointment's immutable
   * `PreScreeningResult.aiPriorityColor` to its (possibly staff-edited) current
   * `Appointment.priorityColor`. Date filter is on `Appointment.startAt` (the visit the
   * triage was for), not `PreScreeningResult.createdAt`, so "accuracy for appointments in
   * July" means exactly that regardless of when the AI call happened relative to the
   * visit. An appointment whose `priorityColor` is `null` (never set/triaged) is treated
   * as "overridden" - it doesn't equal the AI's (always non-null) suggestion.
   */
  async getAiAccuracy(query: DateRangeQueryDto): Promise<AiAccuracyReport> {
    const fromDate = query.from ? startOfDay(new Date(query.from)) : undefined;
    const toDate = query.to ? endOfDay(new Date(query.to)) : undefined;
    this.assertValidRange(fromDate, toDate);

    const qb = this.preScreeningResultRepository
      .createQueryBuilder('preScreeningResult')
      .innerJoin('preScreeningResult.appointment', 'appointment')
      .select('preScreeningResult.aiPriorityColor', 'aiPriorityColor')
      .addSelect('appointment.priorityColor', 'finalPriorityColor');

    if (query.branchId) {
      qb.andWhere('appointment.branchId = :branchId', { branchId: query.branchId });
    }
    if (fromDate) {
      qb.andWhere('appointment.startAt >= :from', { from: fromDate });
    }
    if (toDate) {
      qb.andWhere('appointment.startAt <= :to', { to: toDate });
    }

    const rows = await qb.getRawMany<{
      aiPriorityColor: PriorityColor;
      finalPriorityColor: PriorityColor | null;
    }>();

    const breakdown = new Map<PriorityColor, { acceptedCount: number; overriddenCount: number }>();
    let accepted = 0;

    for (const row of rows) {
      const bucket = breakdown.get(row.aiPriorityColor) ?? { acceptedCount: 0, overriddenCount: 0 };
      if (row.aiPriorityColor === row.finalPriorityColor) {
        accepted += 1;
        bucket.acceptedCount += 1;
      } else {
        bucket.overriddenCount += 1;
      }
      breakdown.set(row.aiPriorityColor, bucket);
    }

    const totalEvaluated = rows.length;
    const breakdownByColor: AiAccuracyByColor[] = Array.from(breakdown.entries())
      .map(([aiPriorityColor, counts]) => ({ aiPriorityColor, ...counts }))
      .sort((a, b) => PRIORITY_COLOR_SEVERITY[a.aiPriorityColor] - PRIORITY_COLOR_SEVERITY[b.aiPriorityColor]);

    return {
      totalEvaluated,
      accepted,
      overridden: totalEvaluated - accepted,
      acceptanceRate: totalEvaluated === 0 ? 0 : accepted / totalEvaluated,
      breakdownByColor,
    };
  }

  /** Guards every report's date-range params against an inverted `from`/`to`. */
  private assertValidRange(fromDate?: Date, toDate?: Date): void {
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('`from` must be on or before `to`');
    }
  }
}
