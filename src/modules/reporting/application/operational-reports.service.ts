import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReportFilterDto } from '@/modules/reporting/presentation/dto/report-filter.dto';
import { DateRangeQueryDto } from '@/modules/reporting/presentation/dto/date-range-query.dto';
import {
  ExamSummaryReport,
  InventoryReport,
  RevenueSummaryReport,
  SalesReportRow,
  TopVeterinarian,
} from './reports.types';

const DEFAULT_EXPIRING_SOON_DAYS = 30;

@Injectable()
export class OperationalReportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get expiringSoonDays(): number {
    const configured = Number(process.env.INVENTORY_EXPIRING_SOON_DAYS);
    return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_EXPIRING_SOON_DAYS;
  }

  async getRevenueSummary(query: ReportFilterDto): Promise<RevenueSummaryReport> {
    this.assertValidRange(query.from, query.to);

    const [row] = await this.dataSource.query<[Record<string, string | null>]>(
      `
      SELECT
        -- Da THU: dong SUCCESS cong dong REFUNDED (dong hoan mang so am), tuc day
        -- la so tien thuc con lai trong ket.
        COALESCE(SUM(p."amount") FILTER (
          WHERE p."status" IN ('SUCCESS', 'REFUNDED')), 0)               AS "totalRevenue",
        COALESCE(SUM(p."amount") FILTER (WHERE p."status" = 'SUCCESS'), 0) AS "totalPaid",
        COALESCE(ABS(SUM(p."amount") FILTER (
          WHERE p."status" = 'REFUNDED')), 0)                            AS "totalRefunded",
        COUNT(DISTINCT p."invoice_id") FILTER (
          WHERE p."status" IN ('SUCCESS', 'REFUNDED'))                   AS "invoiceCount"
        FROM "payments" p
        JOIN "invoices" i ON i."id" = p."invoice_id" AND i."deleted_at" IS NULL
       WHERE p."deleted_at" IS NULL
         AND p."paid_at"::date BETWEEN $1::date AND $2::date
         AND ($3::uuid IS NULL OR i."branch_id" = $3::uuid)
         AND ($4::text IS NULL OR p."method"::text = $4::text)
         AND ($5::uuid IS NULL OR p."received_by_user_id" = $5::uuid)
      `,
      [
        query.from,
        query.to,
        query.branchId ?? null,
        query.paymentMethod ?? null,
        query.employeeUserId ?? null,
      ],
    );

    const [outstanding] = await this.dataSource.query<[Record<string, string | null>]>(
      `
      SELECT COALESCE(SUM(i."total_amount" - COALESCE(paid."amount", 0)), 0) AS "totalUnpaid",
             COUNT(*)                                                        AS "unpaidInvoiceCount"
        FROM "invoices" i
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(p."amount"), 0) AS "amount"
            FROM "payments" p
           WHERE p."invoice_id" = i."id"
             AND p."deleted_at" IS NULL
             AND p."status" IN ('SUCCESS', 'REFUNDED')
        ) paid ON true
       WHERE i."deleted_at" IS NULL
         AND i."status" IN ('PENDING', 'PARTIALLY_PAID')
         AND i."created_at"::date BETWEEN $1::date AND $2::date
         AND ($3::uuid IS NULL OR i."branch_id" = $3::uuid)
      `,
      [query.from, query.to, query.branchId ?? null],
    );

    return {
      totalRevenue: Number(row.totalRevenue ?? 0),
      totalPaid: Number(row.totalPaid ?? 0),
      totalRefunded: Number(row.totalRefunded ?? 0),
      totalUnpaid: Number(outstanding.totalUnpaid ?? 0),
      invoiceCount: Number(row.invoiceCount ?? 0),
      unpaidInvoiceCount: Number(outstanding.unpaidInvoiceCount ?? 0),
    };
  }

  async getInventoryReport(branchId?: string): Promise<InventoryReport> {
    const [row] = await this.dataSource.query<[Record<string, string | null>]>(
      `
      WITH stock AS (
        SELECT inv."id",
               inv."inventory_quantity" AS "quantity",
               COALESCE(pr."minimum_stock", me."minimum_stock", va."minimum_stock", 0) AS "minimum",
               (pr."id" IS NOT NULL) AS "isProduct",
               (me."id" IS NOT NULL) AS "isMedicine",
               (va."id" IS NOT NULL) AS "isVaccine"
          FROM "inventory_items" inv
          JOIN "items" it ON it."id" = inv."item_id" AND it."deleted_at" IS NULL
          LEFT JOIN "products"    pr ON pr."item_id" = it."id" AND pr."deleted_at" IS NULL
          LEFT JOIN "medications" me ON me."item_id" = it."id" AND me."deleted_at" IS NULL
          LEFT JOIN "vaccines"    va ON va."item_id" = it."id" AND va."deleted_at" IS NULL
         WHERE inv."deleted_at" IS NULL AND inv."active" = true
           AND ($1::uuid IS NULL OR inv."branch_id" = $1::uuid)
      )
      SELECT
        COUNT(*) FILTER (WHERE "isProduct")                          AS "totalProducts",
        COUNT(*) FILTER (WHERE "isMedicine")                         AS "totalMedicines",
        COUNT(*) FILTER (WHERE "isVaccine")                          AS "totalVaccines",
        -- Het hang la truong hop rieng cua duoi nguong, nen phai tach ra khoi cot
        -- lowStock - neu khong mot mat hang ton 0 se duoc dem hai lan.
        COUNT(*) FILTER (WHERE "quantity" = 0)                       AS "outOfStock",
        COUNT(*) FILTER (WHERE "quantity" > 0 AND "quantity" <= "minimum") AS "lowStock"
        FROM stock
      `,
      [branchId ?? null],
    );

    const [batches] = await this.dataSource.query<[Record<string, string | null>]>(
      `
      SELECT
        COUNT(*) FILTER (WHERE b."expiry_date" <  CURRENT_DATE)      AS "expired",
        COUNT(*) FILTER (WHERE b."expiry_date" >= CURRENT_DATE
                           AND b."expiry_date" <= CURRENT_DATE + ($2::int * INTERVAL '1 day'))
                                                                     AS "expiringSoon"
        FROM "inventory_batches" b
        JOIN "inventory_items" inv ON inv."id" = b."inventory_item_id" AND inv."deleted_at" IS NULL
       WHERE b."deleted_at" IS NULL
         AND b."quantity" > 0
         AND b."expiry_date" IS NOT NULL
         AND ($1::uuid IS NULL OR inv."branch_id" = $1::uuid)
      `,
      [branchId ?? null, this.expiringSoonDays],
    );

    return {
      totalProducts: Number(row.totalProducts ?? 0),
      totalMedicines: Number(row.totalMedicines ?? 0),
      totalVaccines: Number(row.totalVaccines ?? 0),
      lowStock: Number(row.lowStock ?? 0),
      outOfStock: Number(row.outOfStock ?? 0),
      expiringSoon: Number(batches.expiringSoon ?? 0),
      expired: Number(batches.expired ?? 0),
      expiringSoonDays: this.expiringSoonDays,
    };
  }

  async getSalesReport(query: ReportFilterDto): Promise<SalesReportRow[]> {
    this.assertValidRange(query.from, query.to);

    return this.dataSource.query(
      `
      SELECT it."code"                                        AS "itemCode",
             it."item_name"                                   AS "itemName",
             it."itemType"::text                              AS "itemType",
             SUM(ii."quantity")::int                          AS "quantitySold",
             SUM(ii."price" * ii."quantity")::float8          AS "totalRevenue"
        FROM "invoice_items" ii
        JOIN "invoices" i ON i."id" = ii."invoice_id" AND i."deleted_at" IS NULL
        JOIN "items" it ON it."id" = ii."item_id"
       WHERE ii."deleted_at" IS NULL
         AND i."status" IN ('PAID', 'PARTIALLY_PAID')
         AND i."created_at"::date BETWEEN $1::date AND $2::date
         AND ($3::uuid IS NULL OR i."branch_id" = $3::uuid)
       GROUP BY it."id", it."code", it."item_name", it."itemType"
       ORDER BY SUM(ii."quantity") DESC, it."item_name" ASC
      `,
      [query.from, query.to, query.branchId ?? null],
    );
  }

  async getExamSummary(query: DateRangeQueryDto): Promise<ExamSummaryReport> {
    const from = query.from ?? null;
    const to = query.to ?? null;
    this.assertValidRange(from, to);

    const [row] = await this.dataSource.query<[Record<string, string | null>]>(
      `
      SELECT
        COUNT(*)                                                       AS "totalAppointments",
        COUNT(*) FILTER (WHERE a."status" = 'COMPLETED')               AS "completed",
        COUNT(*) FILTER (WHERE a."status" = 'NO_SHOW')                 AS "noShow",
        COUNT(*) FILTER (WHERE a."status" = 'CANCELLED')               AS "cancelled"
        FROM "appointments" a
       WHERE a."deleted_at" IS NULL
         AND a."start_at" < now()
         AND ($1::date IS NULL OR a."start_at"::date >= $1::date)
         AND ($2::date IS NULL OR a."start_at"::date <= $2::date)
         AND ($3::uuid IS NULL OR a."branch_id" = $3::uuid)
      `,
      [from, to, query.branchId ?? null],
    );

    const topVeterinarians: TopVeterinarian[] = await this.dataSource.query(
      `
      SELECT d."id"                                                    AS "doctorId",
             u."full_name"                                             AS "doctorName",
             COUNT(*)::int                                             AS "examCount",
             COUNT(*) FILTER (WHERE a."status" = 'NO_SHOW')::int        AS "noShowCount"
        FROM "appointments" a
        JOIN "doctors" d ON d."id" = a."doctor_id"
        JOIN "users" u ON u."id" = d."user_id"
       WHERE a."deleted_at" IS NULL
         AND a."start_at" < now()
         AND ($1::date IS NULL OR a."start_at"::date >= $1::date)
         AND ($2::date IS NULL OR a."start_at"::date <= $2::date)
         AND ($3::uuid IS NULL OR a."branch_id" = $3::uuid)
       GROUP BY d."id", u."full_name"
       ORDER BY COUNT(*) FILTER (WHERE a."status" = 'COMPLETED') DESC, u."full_name" ASC
       LIMIT 10
      `,
      [from, to, query.branchId ?? null],
    );

    const total = Number(row.totalAppointments ?? 0);
    const noShow = Number(row.noShow ?? 0);

    return {
      totalAppointments: total,
      completed: Number(row.completed ?? 0),
      noShow,
      cancelled: Number(row.cancelled ?? 0),

      noShowRate: total === 0 ? 0 : noShow / total,
      topVeterinarians,
    };
  }

  private assertValidRange(from: string | null, to: string | null): void {
    if (from && to && from > to) {
      throw new BadRequestException('`from` phải trước hoặc bằng `to`');
    }
  }
}
