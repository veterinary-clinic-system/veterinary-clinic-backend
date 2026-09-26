import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { endOfDay, startOfDay } from 'date-fns';
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
import { getReportTimezone } from './report-timezone';

@Injectable()
export class ReportsService {
  private readonly timezone = getReportTimezone();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Diagnosis) private readonly diagnosisRepository: Repository<Diagnosis>,
    @InjectRepository(PreScreeningResult)
    private readonly preScreeningResultRepository: Repository<PreScreeningResult>,
  ) {}

  async getRevenue(query: RevenueQueryDto): Promise<RevenueByPeriod[]> {
    this.assertValidDateStrings(query.from, query.to);
    const groupBy = query.groupBy ?? 'day';
    const dateFormat = groupBy === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
    const rows = await this.dataSource.query<
      { period: string; totalRevenue: string | null; invoiceCount: string }[]
    >(
      `
      SELECT TO_CHAR(p."paid_at" AT TIME ZONE $4, '${dateFormat}') AS "period",
             COALESCE(SUM(p."amount"), 0)                         AS "totalRevenue",
             COUNT(DISTINCT p."invoice_id")                       AS "invoiceCount"
        FROM "payments" p
        JOIN "invoices" i ON i."id" = p."invoice_id" AND i."deleted_at" IS NULL
       WHERE p."deleted_at" IS NULL
         AND p."status" IN ('SUCCESS', 'REFUNDED')
         AND (p."paid_at" AT TIME ZONE $4)::date BETWEEN $1::date AND $2::date
         AND ($3::uuid IS NULL OR i."branch_id" = $3::uuid)
         AND ($5::text IS NULL OR p."method"::text = $5::text)
         AND ($6::uuid IS NULL OR p."received_by_user_id" = $6::uuid)
       GROUP BY "period"
       ORDER BY "period"
      `,
      [
        query.from,
        query.to,
        query.branchId ?? null,
        this.timezone,
        query.paymentMethod ?? null,
        query.employeeUserId ?? null,
      ],
    );

    return rows.map((row) => ({
      period: row.period,
      totalRevenue: parseFloat(row.totalRevenue ?? '0') || 0,
      invoiceCount: parseInt(row.invoiceCount, 10),
    }));
  }

  async getRevenueByService(query: RevenueFilterQueryDto): Promise<RevenueByService[]> {
    this.assertValidDateStrings(query.from, query.to);
    const rows = await this.dataSource.query<
      { serviceName: string; totalRevenue: string | null; count: string }[]
    >(
      `
      WITH paid_per_invoice AS (
        SELECT p."invoice_id", SUM(p."amount") AS "netPaid"
          FROM "payments" p
          JOIN "invoices" i ON i."id" = p."invoice_id" AND i."deleted_at" IS NULL
         WHERE p."deleted_at" IS NULL
           AND p."status" IN ('SUCCESS', 'REFUNDED')
           AND (p."paid_at" AT TIME ZONE $4)::date BETWEEN $1::date AND $2::date
           AND ($3::uuid IS NULL OR i."branch_id" = $3::uuid)
           AND ($6::text IS NULL OR p."method"::text = $6::text)
           AND ($7::uuid IS NULL OR p."received_by_user_id" = $7::uuid)
         GROUP BY p."invoice_id"
      ), invoice_gross AS (
        SELECT ii."invoice_id", SUM(ii."price" * ii."quantity") AS "gross"
          FROM "invoice_items" ii
         WHERE ii."deleted_at" IS NULL
         GROUP BY ii."invoice_id"
      )
      SELECT it."item_name" AS "serviceName",
             COALESCE(SUM(
               (ii."price" * ii."quantity")::numeric / NULLIF(g."gross", 0) * paid."netPaid"
             ), 0) AS "totalRevenue",
             SUM(ii."quantity")::int AS "count"
        FROM paid_per_invoice paid
        JOIN invoice_gross g ON g."invoice_id" = paid."invoice_id"
        JOIN "invoice_items" ii ON ii."invoice_id" = paid."invoice_id" AND ii."deleted_at" IS NULL
        JOIN "items" it ON it."id" = ii."item_id" AND it."deleted_at" IS NULL
       WHERE it."itemType"::text = $5
       GROUP BY it."id", it."item_name"
       ORDER BY "totalRevenue" DESC
      `,
      [
        query.from,
        query.to,
        query.branchId ?? null,
        this.timezone,
        ItemType.SERVICE,
        query.paymentMethod ?? null,
        query.employeeUserId ?? null,
      ],
    );

    return rows.map((row) => ({
      serviceName: row.serviceName,
      totalRevenue: parseFloat(row.totalRevenue ?? '0') || 0,
      count: parseInt(row.count, 10),
    }));
  }

  async getRevenueByDoctor(query: RevenueFilterQueryDto): Promise<RevenueByDoctor[]> {
    this.assertValidDateStrings(query.from, query.to);
    const rows = await this.dataSource.query<
      {
        doctorId: string;
        doctorName: string;
        totalRevenue: string | null;
        appointmentCount: string;
      }[]
    >(
      `
      SELECT d."id" AS "doctorId",
             d."full_name" AS "doctorName",
             COALESCE(SUM(p."amount"), 0) AS "totalRevenue",
             COUNT(DISTINCT a."id") AS "appointmentCount"
        FROM "payments" p
        JOIN "invoices" i ON i."id" = p."invoice_id" AND i."deleted_at" IS NULL
        JOIN "appointments" a ON a."id" = i."appointment_id" AND a."deleted_at" IS NULL
        JOIN "doctors" d ON d."id" = a."doctor_id" AND d."deleted_at" IS NULL
       WHERE p."deleted_at" IS NULL
         AND p."status" IN ('SUCCESS', 'REFUNDED')
         AND (p."paid_at" AT TIME ZONE $4)::date BETWEEN $1::date AND $2::date
         AND ($3::uuid IS NULL OR i."branch_id" = $3::uuid)
         AND ($5::text IS NULL OR p."method"::text = $5::text)
         AND ($6::uuid IS NULL OR p."received_by_user_id" = $6::uuid)
       GROUP BY d."id", d."full_name"
       ORDER BY "totalRevenue" DESC
      `,
      [
        query.from,
        query.to,
        query.branchId ?? null,
        this.timezone,
        query.paymentMethod ?? null,
        query.employeeUserId ?? null,
      ],
    );

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

  private assertValidDateStrings(from: string, to: string): void {
    if (from > to) {
      throw new BadRequestException('`from` must be on or before `to`');
    }
  }
}
