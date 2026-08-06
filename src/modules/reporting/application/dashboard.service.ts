import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/redis/redis.constants';
import {
  DashboardKpi,
  DashboardResponse,
  DashboardSeries,
  DashboardSeriesPoint,
} from './dashboard.types';

/** NFR-02 doi dashboard duoi 500ms; cache 60s de moi lan mo trang khong quet lai ca nam. */
const CACHE_TTL_SECONDS = 60;
const CACHE_PREFIX = 'dashboard:v1';

/** So ngay cua cac bieu do theo ngay. 30 vua du thay xu huong ma khong lam do thi ret. */
const TREND_DAYS = 30;
/** So thang cua bieu do doanh thu theo thang. */
const TREND_MONTHS = 12;
/** So dong cua cac bang xep hang (san pham ban chay, thuoc dung nhieu, dich vu pho bien). */
const TOP_N = 5;

/**
 * Dashboard dieu hanh - SRS FR-24 (P10-T3).
 *
 * MOT ENDPOINT CHO CA TRANG. Tam the KPI va tam bieu do di trong dung mot request. Tach
 * thanh muoi sau endpoint thi moi lan mo trang la muoi sau vong ket noi, muoi sau lan
 * kiem tra JWT va muoi sau truy van cham nhau tren cung mot bo bang - vua cham hon vua
 * lam so lieu lech nhau (moi endpoint chot "hom nay" o mot mili giay khac).
 *
 * CACHE REDIS 60 GIAY. Dashboard la trang duoc mo lai nhieu nhat trong ngay va la trang
 * ton truy van nhat. 60 giay du de moi lan F5 khong danh vao CSDL, va du ngan de con so
 * tren man hinh khong bao gio lech qua mot phut so voi thuc te - nguong ma nguoi dung
 * khong nhan ra. `generatedAt` di kem trong ket qua nen giao dien noi duoc so lieu chot
 * luc nao thay vi de nguoi dung doan.
 *
 * Redis chet KHONG lam hong dashboard: moi thao tac cache deu boc trong try/catch va roi
 * ve truy van thang. Cung nguyen tac da ghi o `RedisModule` - cache la toi uu hieu nang,
 * khong bao gio la phu thuoc dung sai.
 *
 * VIET BANG SQL THO chu khong QueryBuilder: mot the KPI la mot dong `COUNT(*)` co dieu
 * kien, va gop tam cai vao MOT truy van bang `SELECT (SELECT ...), (SELECT ...)` la cach
 * duy nhat de ca trang chi ton mot vong ket noi. Dien dat dieu do qua QueryBuilder se ra
 * mot doan code kho doc hon han chinh cau SQL.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getDashboard(branchId?: string): Promise<DashboardResponse> {
    const cacheKey = `${CACHE_PREFIX}:${branchId ?? 'all'}`;

    const cached = await this.readCache(cacheKey);
    if (cached) {
      return cached;
    }

    const [kpis, charts] = await Promise.all([
      this.queryKpis(branchId ?? null),
      this.queryCharts(branchId ?? null),
    ]);

    const response: DashboardResponse = {
      generatedAt: new Date().toISOString(),
      branchId: branchId ?? null,
      kpis,
      charts,
    };

    await this.writeCache(cacheKey, response);
    return response;
  }

  // ------------------------------------------------------------------ Tam the KPI

  /**
   * Tam con so cua SRS muc 12.
   *
   * Moi cap cot la (hom nay, hom qua) de tinh `deltaRatio` - mot con so tran khong noi
   * len dieu gi neu khong biet no dang tang hay giam. Bon chi so "hom qua" cua ton kho
   * khong ton tai (ton kho la anh chup hien tai, khong co "ton kho cua hom qua" trong
   * lieu do nay) nen chung tra `null`.
   *
   * "Waiting Patients" dem theo dung dieu kien cua man hinh Hang cho - `WAITING` va
   * `ASSIGNED` cua NGAY HOM NAY. Acceptance P10-T3 doi hai con so nay khop nhau, nen neu
   * doi dieu kien o `QueueService` thi phai doi ca o day.
   */
  private async queryKpis(branchId: string | null): Promise<DashboardKpi[]> {
    const [row] = await this.dataSource.query<[Record<string, string | null>]>(
      `
      SELECT
        (SELECT COALESCE(SUM(p."amount"), 0)
           FROM "payments" p
           JOIN "invoices" i ON i."id" = p."invoice_id" AND i."deleted_at" IS NULL
          WHERE p."deleted_at" IS NULL
            AND p."status" IN ('SUCCESS', 'REFUNDED')
            AND p."paid_at"::date = CURRENT_DATE
            AND ($1::uuid IS NULL OR i."branch_id" = $1::uuid))          AS "revenueToday",

        (SELECT COALESCE(SUM(p."amount"), 0)
           FROM "payments" p
           JOIN "invoices" i ON i."id" = p."invoice_id" AND i."deleted_at" IS NULL
          WHERE p."deleted_at" IS NULL
            AND p."status" IN ('SUCCESS', 'REFUNDED')
            AND p."paid_at"::date = CURRENT_DATE - 1
            AND ($1::uuid IS NULL OR i."branch_id" = $1::uuid))          AS "revenueYesterday",

        (SELECT COUNT(*) FROM "appointments" a
          WHERE a."deleted_at" IS NULL AND a."start_at"::date = CURRENT_DATE
            AND ($1::uuid IS NULL OR a."branch_id" = $1::uuid))          AS "appointmentsToday",
        (SELECT COUNT(*) FROM "appointments" a
          WHERE a."deleted_at" IS NULL AND a."start_at"::date = CURRENT_DATE - 1
            AND ($1::uuid IS NULL OR a."branch_id" = $1::uuid))          AS "appointmentsYesterday",

        (SELECT COUNT(*) FROM "medical_records" r
           JOIN "appointments" a ON a."id" = r."appointment_id"
          WHERE r."deleted_at" IS NULL AND r."status" = 'COMPLETED'
            AND r."completed_at"::date = CURRENT_DATE
            AND ($1::uuid IS NULL OR a."branch_id" = $1::uuid))          AS "examsToday",
        (SELECT COUNT(*) FROM "medical_records" r
           JOIN "appointments" a ON a."id" = r."appointment_id"
          WHERE r."deleted_at" IS NULL AND r."status" = 'COMPLETED'
            AND r."completed_at"::date = CURRENT_DATE - 1
            AND ($1::uuid IS NULL OR a."branch_id" = $1::uuid))          AS "examsYesterday",

        -- BA trang thai, khong phai hai: day dung la tap ma trang Hang cho hien mac
        -- dinh (xem ACTIVE_QUEUE_STATUSES). Bo 'IN_ROOM' o day thi the KPI se hien mot
        -- so nho hon so dong nguoi dung dem duoc tren chinh man hinh ma no dan toi -
        -- va hai con so lech nhau tren cung mot giao dien lam mat long tin vao ca
        -- dashboard, du "dang trong phong kham" doi la khong con dung cho.
        (SELECT COUNT(*) FROM "queue_entries" q
          WHERE q."deleted_at" IS NULL
            AND q."queue_date" = CURRENT_DATE
            AND q."status" IN ('WAITING', 'ASSIGNED', 'IN_ROOM')
            AND ($1::uuid IS NULL OR q."branch_id" = $1::uuid))          AS "waitingPatients",

        (SELECT COUNT(*) FROM "users" u
          WHERE u."deleted_at" IS NULL AND u."role" = 'PET_OWNER'
            AND u."created_at"::date = CURRENT_DATE)                     AS "newCustomersToday",
        (SELECT COUNT(*) FROM "users" u
          WHERE u."deleted_at" IS NULL AND u."role" = 'PET_OWNER'
            AND u."created_at"::date = CURRENT_DATE - 1)                 AS "newCustomersYesterday",

        (SELECT COUNT(*) FROM "pets" p
          WHERE p."deleted_at" IS NULL AND p."created_at"::date = CURRENT_DATE)
                                                                          AS "newPetsToday",
        (SELECT COUNT(*) FROM "pets" p
          WHERE p."deleted_at" IS NULL AND p."created_at"::date = CURRENT_DATE - 1)
                                                                          AS "newPetsYesterday",

        (SELECT COUNT(*) FROM "inventory_items" inv
           JOIN "items" it ON it."id" = inv."item_id" AND it."deleted_at" IS NULL
           JOIN "products" pr ON pr."item_id" = it."id" AND pr."deleted_at" IS NULL
          WHERE inv."deleted_at" IS NULL AND inv."active" = true
            AND inv."inventory_quantity" <= pr."minimum_stock"
            AND ($1::uuid IS NULL OR inv."branch_id" = $1::uuid))         AS "lowStockProducts",

        (SELECT COUNT(*) FROM "inventory_items" inv
           JOIN "items" it ON it."id" = inv."item_id" AND it."deleted_at" IS NULL
           JOIN "medications" me ON me."item_id" = it."id" AND me."deleted_at" IS NULL
          WHERE inv."deleted_at" IS NULL AND inv."active" = true
            AND inv."inventory_quantity" <= me."minimum_stock"
            AND ($1::uuid IS NULL OR inv."branch_id" = $1::uuid))         AS "lowStockMedicines"
      `,
      [branchId],
    );

    const n = (key: string): number => Number(row[key] ?? 0);

    return [
      this.kpi(
        'revenueToday',
        'Doanh thu hôm nay',
        n('revenueToday'),
        'currency',
        n('revenueYesterday'),
        '/staff/billing',
      ),
      this.kpi(
        'appointmentsToday',
        'Lịch hẹn hôm nay',
        n('appointmentsToday'),
        'count',
        n('appointmentsYesterday'),
        '/staff/appointments',
      ),
      this.kpi(
        'examsToday',
        'Lượt khám hoàn tất',
        n('examsToday'),
        'count',
        n('examsYesterday'),
        '/staff/patients',
      ),
      this.kpi(
        'waitingPatients',
        // "Trong hang cho" chu khong phai "dang cho kham": con so dem ca luot da vao
        // phong, nen nhan phai noi dung cai no dem.
        'Đang trong hàng chờ',
        n('waitingPatients'),
        'count',
        null,
        '/staff/queue',
      ),
      this.kpi(
        'newCustomersToday',
        'Khách mới',
        n('newCustomersToday'),
        'count',
        n('newCustomersYesterday'),
        '/staff/customers',
      ),
      this.kpi(
        'newPetsToday',
        'Thú cưng mới',
        n('newPetsToday'),
        'count',
        n('newPetsYesterday'),
        '/staff/patients',
      ),
      this.kpi(
        'lowStockProducts',
        'Sản phẩm sắp hết',
        n('lowStockProducts'),
        'count',
        null,
        '/staff/inventory/alerts',
      ),
      this.kpi(
        'lowStockMedicines',
        'Thuốc sắp hết',
        n('lowStockMedicines'),
        'count',
        null,
        '/staff/inventory/alerts',
      ),
    ];
  }

  private kpi(
    key: string,
    label: string,
    value: number,
    format: 'currency' | 'count',
    previous: number | null,
    link?: string,
  ): DashboardKpi {
    return {
      key,
      label,
      value,
      format,
      // Ky truoc bang 0 -> `null` chu khong phai vo cuc hay 100%. Xem `DashboardKpi`.
      deltaRatio: previous === null || previous === 0 ? null : (value - previous) / previous,
      link,
    };
  }

  // -------------------------------------------------------------------- Bieu do

  private async queryCharts(branchId: string | null): Promise<DashboardSeries[]> {
    const [
      revenueByDay,
      revenueByMonth,
      examsByDay,
      newCustomersByDay,
      newPetsByDay,
      topProducts,
      topMedicines,
      topServices,
    ] = await Promise.all([
      this.revenueByDay(branchId),
      this.revenueByMonth(branchId),
      this.examsByDay(branchId),
      this.newCustomersByDay(),
      this.newPetsByDay(),
      this.topSoldItems(branchId, 'PRODUCT'),
      this.topSoldItems(branchId, 'MEDICATION'),
      this.topSoldItems(branchId, 'SERVICE'),
    ]);

    return [
      {
        key: 'revenueByDay',
        title: `Doanh thu ${TREND_DAYS} ngày qua`,
        format: 'currency',
        points: revenueByDay,
      },
      {
        key: 'revenueByMonth',
        title: `Doanh thu ${TREND_MONTHS} tháng qua`,
        format: 'currency',
        points: revenueByMonth,
      },
      {
        key: 'examsByDay',
        title: `Lượt khám ${TREND_DAYS} ngày qua`,
        format: 'count',
        points: examsByDay,
      },
      {
        key: 'newCustomersByDay',
        title: `Khách mới ${TREND_DAYS} ngày qua`,
        format: 'count',
        points: newCustomersByDay,
      },
      {
        key: 'newPetsByDay',
        title: `Thú cưng mới ${TREND_DAYS} ngày qua`,
        format: 'count',
        points: newPetsByDay,
      },
      { key: 'topProducts', title: 'Sản phẩm bán chạy', format: 'count', points: topProducts },
      { key: 'topMedicines', title: 'Thuốc dùng nhiều', format: 'count', points: topMedicines },
      { key: 'topServices', title: 'Dịch vụ phổ biến', format: 'count', points: topServices },
    ];
  }

  /**
   * `generate_series` de NGAY KHONG CO DU LIEU van la mot diem gia tri 0.
   *
   * Khong co no thi bieu do se noi thang tu thu Hai sang thu Sau va giau mat hai ngay
   * nghi - duong di len trong khi thuc te la mot khoang trong. Cung ly do cho ca nam
   * bieu do theo thoi gian ben duoi.
   */
  private revenueByDay(branchId: string | null): Promise<DashboardSeriesPoint[]> {
    return this.dataSource.query(
      `
      SELECT to_char(d."day", 'DD/MM')                      AS "label",
             COALESCE(SUM(p."amount"), 0)::float8           AS "value"
        FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, '1 day') AS d("day")
        LEFT JOIN "payments" p
               ON p."paid_at"::date = d."day"
              AND p."deleted_at" IS NULL
              AND p."status" IN ('SUCCESS', 'REFUNDED')
        LEFT JOIN "invoices" i
               ON i."id" = p."invoice_id" AND i."deleted_at" IS NULL
       WHERE (p."id" IS NULL OR $1::uuid IS NULL OR i."branch_id" = $1::uuid)
       GROUP BY d."day"
       ORDER BY d."day"
      `,
      [branchId, TREND_DAYS],
    );
  }

  private revenueByMonth(branchId: string | null): Promise<DashboardSeriesPoint[]> {
    return this.dataSource.query(
      `
      SELECT to_char(d."month", 'MM/YYYY')                  AS "label",
             COALESCE(SUM(p."amount"), 0)::float8           AS "value"
        FROM generate_series(
               date_trunc('month', CURRENT_DATE) - (($2::int - 1) || ' month')::interval,
               date_trunc('month', CURRENT_DATE),
               '1 month'
             ) AS d("month")
        LEFT JOIN "payments" p
               ON date_trunc('month', p."paid_at") = d."month"
              AND p."deleted_at" IS NULL
              AND p."status" IN ('SUCCESS', 'REFUNDED')
        LEFT JOIN "invoices" i
               ON i."id" = p."invoice_id" AND i."deleted_at" IS NULL
       WHERE (p."id" IS NULL OR $1::uuid IS NULL OR i."branch_id" = $1::uuid)
       GROUP BY d."month"
       ORDER BY d."month"
      `,
      [branchId, TREND_MONTHS],
    );
  }

  private examsByDay(branchId: string | null): Promise<DashboardSeriesPoint[]> {
    return this.dataSource.query(
      `
      SELECT to_char(d."day", 'DD/MM')  AS "label",
             COUNT(r."id")::float8      AS "value"
        FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, '1 day') AS d("day")
        LEFT JOIN "medical_records" r
               ON r."completed_at"::date = d."day"
              AND r."deleted_at" IS NULL
              AND r."status" = 'COMPLETED'
        LEFT JOIN "appointments" a ON a."id" = r."appointment_id"
       WHERE (r."id" IS NULL OR $1::uuid IS NULL OR a."branch_id" = $1::uuid)
       GROUP BY d."day"
       ORDER BY d."day"
      `,
      [branchId, TREND_DAYS],
    );
  }

  /**
   * Khach hang va thu cung KHONG loc theo chi nhanh: ca hai deu khong thuoc ve chi nhanh
   * nao ca (mot khach kham o Quan 1 hom nay va Quan 7 tuan sau van la mot khach). Gan
   * chung vao chi nhanh cua lan kham dau se dem trung khi khach doi cho.
   */
  private newCustomersByDay(): Promise<DashboardSeriesPoint[]> {
    return this.dataSource.query(
      `
      SELECT to_char(d."day", 'DD/MM')  AS "label",
             COUNT(u."id")::float8      AS "value"
        FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, '1 day') AS d("day")
        LEFT JOIN "users" u
               ON u."created_at"::date = d."day"
              AND u."deleted_at" IS NULL
              AND u."role" = 'PET_OWNER'
       GROUP BY d."day"
       ORDER BY d."day"
      `,
      [TREND_DAYS],
    );
  }

  private newPetsByDay(): Promise<DashboardSeriesPoint[]> {
    return this.dataSource.query(
      `
      SELECT to_char(d."day", 'DD/MM')  AS "label",
             COUNT(p."id")::float8      AS "value"
        FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, '1 day') AS d("day")
        LEFT JOIN "pets" p
               ON p."created_at"::date = d."day" AND p."deleted_at" IS NULL
       GROUP BY d."day"
       ORDER BY d."day"
      `,
      [TREND_DAYS],
    );
  }

  /**
   * Bang xep hang theo SO LUONG ban, khong theo doanh thu.
   *
   * "Ban chay" la cau hoi ve so luot, con "dem lai nhieu tien nhat" la mot cau hoi khac
   * co bao cao rieng (`/reports/revenue/by-service`). Mot dich vu phau thuat mot lan mot
   * trieu khong lam no "pho bien" hon mot lan tiem phong.
   */
  private topSoldItems(branchId: string | null, itemType: string): Promise<DashboardSeriesPoint[]> {
    return this.dataSource.query(
      `
      SELECT it."item_name"                          AS "label",
             SUM(ii."quantity")::float8              AS "value"
        FROM "invoice_items" ii
        JOIN "invoices" i ON i."id" = ii."invoice_id" AND i."deleted_at" IS NULL
        JOIN "items" it ON it."id" = ii."item_id"
       WHERE ii."deleted_at" IS NULL
         AND it."itemType"::text = $2
         AND i."status" IN ('PAID', 'PARTIALLY_PAID')
         AND i."created_at" >= CURRENT_DATE - ($3::int - 1)
         AND ($1::uuid IS NULL OR i."branch_id" = $1::uuid)
       GROUP BY it."id", it."item_name"
       ORDER BY SUM(ii."quantity") DESC
       LIMIT ${TOP_N}
      `,
      [branchId, itemType, TREND_DAYS],
    );
  }

  // ---------------------------------------------------------------------- Cache

  private async readCache(key: string): Promise<DashboardResponse | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? (JSON.parse(cached) as DashboardResponse) : null;
    } catch (error) {
      this.logger.warn(`Khong doc duoc cache dashboard: ${(error as Error).message}`);
      return null;
    }
  }

  private async writeCache(key: string, value: DashboardResponse): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Khong ghi duoc cache dashboard: ${(error as Error).message}`);
    }
  }
}
