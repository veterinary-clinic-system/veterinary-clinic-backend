import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
import { Diagnosis } from '@/modules/clinical/domain/entities/diagnosis.entity';
import { PreScreeningResult } from '@/modules/triage/domain/entities/pre-screening-result.entity';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { PRIORITY_COLOR_SEVERITY, PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { DateRangeQueryDto } from '@/modules/reporting/presentation/dto/date-range-query.dto';
import { RevenueFilterQueryDto } from '@/modules/reporting/presentation/dto/revenue-filter-query.dto';
import { RevenueQueryDto } from '@/modules/reporting/presentation/dto/revenue-query.dto';
import {
  AiAccuracyByColor,
  AiAccuracyReport,
  ExamVolumeByDiseaseGroup,
  RevenueByDoctor,
  RevenueByPeriod,
  RevenueByService,
} from './reports.types';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(InvoiceItem) private readonly invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Diagnosis) private readonly diagnosisRepository: Repository<Diagnosis>,
    @InjectRepository(PreScreeningResult)
    private readonly preScreeningResultRepository: Repository<PreScreeningResult>,
  ) {}

  async getRevenue(query: RevenueQueryDto): Promise<RevenueByPeriod[]> {
    const fromDate = startOfDay(new Date(query.from));
    const toDate = endOfDay(new Date(query.to));
    this.assertValidRange(fromDate, toDate);

    const groupBy = query.groupBy ?? 'day';
    const dateFormat = groupBy === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';

    const periodExpr = `TO_CHAR(invoice.paid_at, '${dateFormat}')`;

    const qb = this.invoiceItemRepository
      .createQueryBuilder('invoiceItem')
      .innerJoin('invoiceItem.invoice', 'invoice')
      .where('invoice.paid = :paid', { paid: true })
      .andWhere('invoice.paidAt >= :from', { from: fromDate })
      .andWhere('invoice.paidAt <= :to', { to: toDate });

    if (query.branchId) {
      qb.innerJoin('invoice.appointment', 'appointment').andWhere(
        'appointment.branchId = :branchId',
        {
          branchId: query.branchId,
        },
      );
    }

    const rows = await qb
      .select(periodExpr, 'period')
      .addSelect('SUM(invoiceItem.price * invoiceItem.quantity)', 'totalRevenue')
      .addSelect('COUNT(DISTINCT invoice.id)', 'invoiceCount')

      .groupBy(periodExpr)
      .orderBy(periodExpr, 'ASC')
      .getRawMany<{ period: string; totalRevenue: string | null; invoiceCount: string }>();

    return rows.map((row) => ({
      period: row.period,
      totalRevenue: parseFloat(row.totalRevenue ?? '0') || 0,
      invoiceCount: parseInt(row.invoiceCount, 10),
    }));
  }

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
      qb.innerJoin('invoice.appointment', 'appointment').andWhere(
        'appointment.branchId = :branchId',
        {
          branchId: query.branchId,
        },
      );
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
      .getRawMany<{
        doctorId: string;
        doctorName: string;
        totalRevenue: string | null;
        appointmentCount: string;
      }>();

    return rows.map((row) => ({
      doctorId: row.doctorId,
      doctorName: row.doctorName,
      totalRevenue: parseFloat(row.totalRevenue ?? '0') || 0,
      appointmentCount: parseInt(row.appointmentCount, 10),
    }));
  }

  async getExamVolumeByDiseaseGroup(query: DateRangeQueryDto): Promise<ExamVolumeByDiseaseGroup[]> {
    const fromDate = query.from ? startOfDay(new Date(query.from)) : undefined;
    const toDate = query.to ? endOfDay(new Date(query.to)) : undefined;
    this.assertValidRange(fromDate, toDate);

    const qb = this.diagnosisRepository
      .createQueryBuilder('diagnosis')
      .innerJoin('diagnosis.medicalRecord', 'medicalRecord')
      
      .leftJoin('medicalRecord.examination', 'examination')
      .leftJoin('diagnosis.disease', 'disease')
      .select('COALESCE(disease.disease_name, diagnosis.diagnosis_text)', 'diseaseGroup')
      .addSelect('COUNT(*)', 'count');

    if (query.branchId) {
      qb.innerJoin('medicalRecord.appointment', 'appointment').andWhere(
        'appointment.branchId = :branchId',
        {
          branchId: query.branchId,
        },
      );
    }

    const examinedAtExpr = 'COALESCE(examination.examined_at, medicalRecord.created_at)';
    if (fromDate) {
      qb.andWhere(`${examinedAtExpr} >= :from`, { from: fromDate });
    }
    if (toDate) {
      qb.andWhere(`${examinedAtExpr} <= :to`, { to: toDate });
    }

    const rows = await qb
      .groupBy('"diseaseGroup"')
      .orderBy('"count"', 'DESC')
      .getRawMany<{ diseaseGroup: string; count: string }>();

    return rows.map((row) => ({ diseaseGroup: row.diseaseGroup, count: parseInt(row.count, 10) }));
  }

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
      .sort(
        (a, b) =>
          PRIORITY_COLOR_SEVERITY[a.aiPriorityColor] - PRIORITY_COLOR_SEVERITY[b.aiPriorityColor],
      );

    return {
      totalEvaluated,
      accepted,
      overridden: totalEvaluated - accepted,
      acceptanceRate: totalEvaluated === 0 ? 0 : accepted / totalEvaluated,
      breakdownByColor,
    };
  }

  private assertValidRange(fromDate?: Date, toDate?: Date): void {
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('`from` must be on or before `to`');
    }
  }
}
