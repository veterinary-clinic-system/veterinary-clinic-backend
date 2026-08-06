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

/** Nguong "sap het han" cua bao cao kho - khop `INVENTORY_EXPIRING_SOON_DAYS` cua P6. */
const DEFAULT_EXPIRING_SOON_DAYS = 30;

/**
 * Ba nhom bao cao van hanh cua SRS muc 19 - P10-T4.
 *
 * Tach khoi `ReportsService` (bao cao doanh thu, co tu P4) co chu dich: bao cao cu doc
 * qua QueryBuilder tren `InvoiceItem`, con ba bao cao nay deu la truy van tong hop nhieu
 * bang voi `FILTER (WHERE ...)` - viet bang SQL tho de doc hon han. Gop chung mot lop se
 * thanh mot file bay tram dong tron hai phong cach.
 *
 * DOANH THU DOC TU `payments`, KHONG TU `invoice_items`. Day la khac biet quan trong so
 * voi `ReportsService.getRevenue`: bao cao cu tong `price * quantity` cua cac dong hang
 * tren hoa don da tra, tuc no tra loi "da BAN bao nhieu". Muc 19 hoi "Total Revenue /
 * Paid / Unpaid / Refunded" - do la cau hoi ve TIEN THUC THU, va cau tra loi chi co o
 * bang `payments` (mot hoa don tra hai lan, mot hoa don hoan mot phan). Hai con so nay
 * khac nhau la dung, khong phai loi.
 */
@Injectable()
export class OperationalReportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get expiringSoonDays(): number {
    const configured = Number(process.env.INVENTORY_EXPIRING_SOON_DAYS);
    return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_EXPIRING_SOON_DAYS;
  }

  // ---------------------------------------------------------- Bao cao doanh thu

  /** Tong hop doanh thu theo dung sau con so cua SRS muc 19. */
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

    // CHUA THU tinh tren HOA DON chu khong tren `payments`: mot hoa don chua tra dong nao
    // khong co dong `payments` nao ca, nen truy van o tren khong bao gio nhin thay no.
    // Day chinh la cho de sai nhat cua bao cao nay.
    //
    // `invoices` KHONG CO cot "da thu" - so do luon duoc tinh lai tu `payments` (xem
    // `PaymentsService.paidAmountOf`). Mot cot tong tien tren hoa don se la ban sao thu
    // hai cua cung su that, va no se lech ngay lan hoan tien dau tien. Vi vay o day
    // dung LEFT JOIN LATERAL de cong lai dung cong thuc ay cho tung hoa don.
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

  // ------------------------------------------------------------- Bao cao kho

  /**
   * Anh chup kho tai THOI DIEM DOC - khong nhan khoang ngay.
   *
   * Muc 19 liet ke sau con so: Total Products, Total Medicines, Low Stock, Out of Stock,
   * Expiring Soon, Expired. Ca sau deu la cau hoi ve HIEN TAI ("dang con bao nhieu mat
   * hang duoi nguong"), khong phai ve mot khoang qua khu. Them tham so ngay vao day se
   * tao ra mot bao cao tra loi sai mot cach thuyet phuc: kho khong luu lich su ton theo
   * ngay, nen "ton kho ngay 01/07" chi co the la ton HOM NAY duoc dan nhan ngay 01/07.
   */
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

  // -------------------------------------------------------- Bao cao ban hang

  /** San pham ban chay: so luong ban va doanh thu, nhieu nhat truoc (muc 19). */
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

  // ----------------------------------------------------------- Bao cao kham

  /**
   * Bo sung No-show va Top Veterinarians vao bao cao kham dang co (muc 19).
   *
   * `noShowRate` tinh tren tong lich hen DA DEN HAN trong ky (khong tinh lich con
   * `PENDING`/`CONFIRMED` cua tuong lai): mot lich hen tuan sau chua co co hoi de vang
   * mat, dem no vao mau so chi lam ty le vang thap gia.
   */
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
      // Mau so 0 -> ty le 0, khong phai NaN. Mot bao cao hien "NaN%" lam nguoi doc mat
      // long tin vao ca trang, du con so con lai deu dung.
      noShowRate: total === 0 ? 0 : noShow / total,
      topVeterinarians,
    };
  }

  // ------------------------------------------------------------------ Ben trong

  private assertValidRange(from: string | null, to: string | null): void {
    if (from && to && from > to) {
      throw new BadRequestException('`from` phải trước hoặc bằng `to`');
    }
  }
}
