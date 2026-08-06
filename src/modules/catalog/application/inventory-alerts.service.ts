import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxService, StaffNotificationsService } from '@/modules/notification/application';
import { StaffNotificationType } from '@/shared/common/enums/staff-notification.enum';
import { toDateOnly } from '@/modules/catalog/domain/inventory-allocation.util';

/**
 * Nguong "sap het han" tinh bang ngay - FR-18-04.
 *
 * De o day thay vi hard-code trong truy van, va doc duoc qua bien moi truong: nguong
 * hop ly khac han giua thuoc (dat hang lai mat vai tuan) va thuc an (vai ngay).
 */
const DEFAULT_EXPIRING_SOON_DAYS = 30;

export type InventoryAlertKind = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING_SOON' | 'EXPIRED';

export interface InventoryAlertRow {
  inventoryItemId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  branchId: string;
  branchName: string;
  quantity: number;
  minimumStock: number;
  /** Chi co o `EXPIRING_SOON` / `EXPIRED`. */
  batchId?: string;
  batchNo?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
}

export interface InventoryAlerts {
  lowStock: InventoryAlertRow[];
  outOfStock: InventoryAlertRow[];
  expiringSoon: InventoryAlertRow[];
  expired: InventoryAlertRow[];
}

/** Bon nhom canh bao kho anh xa mot-doi-mot sang bon loai thong bao nhan vien (P10-T5). */
const STAFF_NOTIFICATION_TYPE: Record<InventoryAlertKind, StaffNotificationType> = {
  LOW_STOCK: StaffNotificationType.LOW_STOCK,
  OUT_OF_STOCK: StaffNotificationType.OUT_OF_STOCK,
  EXPIRING_SOON: StaffNotificationType.EXPIRING_SOON,
  EXPIRED: StaffNotificationType.EXPIRED,
};

/**
 * Tieu de mot dong thong bao la TEN MAT HANG, khong phai ten loai canh bao.
 *
 * Giao dien da hien loai canh bao bang mot nhan mau ngay canh ("Hết hàng", "Sắp hết
 * hạn"), nen mot tieu de "Hàng đã hết" chi lap lai chinh cai nhan do bang chu khac -
 * hai dong dau tien cua thong bao noi cung mot dieu, va nguoi doc van chua biet la hang
 * nao. Ten mat hang o day tra loi ngay cau ho thuc su hoi.
 */
function alertTitle(row: InventoryAlertRow): string {
  return `${row.itemName} (${row.itemCode})`;
}

/**
 * Noi dung mot dong thong bao.
 *
 * Viet du de KHONG PHAI MO MAN HINH KHAC moi hieu: co chi nhanh va con so cu the. Ten
 * mat hang khong lap lai o day - no da la tieu de.
 */
function describeAlert(kind: InventoryAlertKind, row: InventoryAlertRow): string {
  switch (kind) {
    case 'OUT_OF_STOCK':
      return `${row.branchName}: đã hết hàng — không bán và không cấp phát được.`;
    case 'LOW_STOCK':
      return `${row.branchName}: còn ${row.quantity}, đã chạm ngưỡng tối thiểu ${row.minimumStock}.`;
    case 'EXPIRING_SOON':
      return `${row.branchName}, lô ${row.batchNo ?? '—'}: hết hạn ngày ${row.expiryDate ?? '—'} (còn ${row.daysUntilExpiry ?? 0} ngày).`;
    case 'EXPIRED':
      return `${row.branchName}, lô ${row.batchNo ?? '—'}: đã hết hạn ngày ${row.expiryDate ?? '—'} — cần lập phiếu xuất hủy.`;
  }
}

/**
 * Canh bao ton kho - SRS FR-18-04.
 *
 * KHONG GUI THANG. Cron ghi su kien vao outbox (`OutboxService`), worker doc outbox roi
 * moi gui - dung kien truc Phan IV.2 da co san. Gui thang tu day thi mot lan cron loi
 * giua chung se de lai vai canh bao da gui va vai cai chua, khong lam lai duoc.
 *
 * `dedupeKey` chua NGAY: `inv-alert:<loai>:<id>:<YYYY-MM-DD>`. Nho vay chay cron hai lan
 * trong ngay (deploy lai, chay tay de kiem tra) khong sinh canh bao trung - dung dam
 * bao idempotent ma `OutboxEvent.dedupeKey` sinh ra de lam.
 *
 * Truy van doc thang bang SQL chu khong qua QueryBuilder: nguong ton nam o
 * `products.minimum_stock` HOAC `medications.minimum_stock` tuy mat hang la gi, va
 * COALESCE hai bang qua entity se ra mot truy van kho doc hon chinh cau SQL.
 */
@Injectable()
export class InventoryAlertsService {
  private readonly logger = new Logger(InventoryAlertsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
    private readonly staffNotificationsService: StaffNotificationsService,
  ) {}

  private get expiringSoonDays(): number {
    const configured = Number(process.env.INVENTORY_EXPIRING_SOON_DAYS);
    return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_EXPIRING_SOON_DAYS;
  }

  /** Bon nhom canh bao cho endpoint `GET /catalog/inventory/alerts` (P6-T8). */
  async collect(branchId?: string): Promise<InventoryAlerts> {
    const [stockRows, expiryRows] = await Promise.all([
      this.queryStockLevels(branchId),
      this.queryExpiringBatches(branchId),
    ]);

    return {
      // Het hang la truong hop rieng cua duoi nguong, nen phai tach truoc khi loc
      // `LOW_STOCK` - neu khong, mat hang ton 0 se hien o ca hai nhom.
      outOfStock: stockRows.filter((row) => row.quantity === 0),
      lowStock: stockRows.filter((row) => row.quantity > 0 && row.quantity <= row.minimumStock),
      expiringSoon: expiryRows.filter((row) => (row.daysUntilExpiry ?? 0) >= 0),
      expired: expiryRows.filter((row) => (row.daysUntilExpiry ?? 0) < 0),
    };
  }

  /**
   * Chay 07:00 moi ngay - truoc gio mo cua, de nguoi phu trach kho co canh bao ngay khi
   * bat dau ca lam viec.
   */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async publishDailyAlerts(): Promise<number> {
    const alerts = await this.collect();
    const today = toDateOnly(new Date());

    const events: { kind: InventoryAlertKind; row: InventoryAlertRow }[] = [
      ...alerts.outOfStock.map((row) => ({ kind: 'OUT_OF_STOCK' as const, row })),
      ...alerts.lowStock.map((row) => ({ kind: 'LOW_STOCK' as const, row })),
      ...alerts.expiringSoon.map((row) => ({ kind: 'EXPIRING_SOON' as const, row })),
      ...alerts.expired.map((row) => ({ kind: 'EXPIRED' as const, row })),
    ];

    if (events.length === 0) {
      return 0;
    }

    // Mot transaction cho ca me: outbox chi co y nghia khi su kien duoc ghi cung mot
    // don vi cong viec voi cai sinh ra no. O day khong co thay doi nghiep vu nao di
    // kem, nhung gom lai van dung hon - hoac ca me canh bao cua ngay hom nay duoc ghi,
    // hoac khong cai nao, thay vi mot nua.
    await this.dataSource.transaction(async (em) => {
      for (const event of events) {
        const scope = event.row.batchId ?? event.row.inventoryItemId;
        const dedupeKey = `inv-alert:${event.kind}:${scope}:${today}`;

        await this.outboxService.record(em, {
          type: `INVENTORY_${event.kind}`,
          payload: { ...event.row, kind: event.kind, detectedOn: today },
          dedupeKey,
        });

        // Thong bao trong ung dung di CUNG transaction voi su kien outbox, nhung KHONG
        // qua outbox (P10-T5): no khong roi khoi CSDL nay nen khong can mot chang trung
        // gian de bao dam gui. Nguoi nhan theo bang muc 18 SRS - duoc si va quan ly.
        await this.staffNotificationsService.notify(em, {
          type: STAFF_NOTIFICATION_TYPE[event.kind],
          title: alertTitle(event.row),
          body: describeAlert(event.kind, event.row),
          link: '/staff/inventory/alerts',
          branchId: event.row.branchId,
          dedupeKey,
        });
      }
    });

    this.logger.log(`Da ghi ${events.length} canh bao ton kho vao outbox (${today})`);
    return events.length;
  }

  // ------------------------------------------------------------------ Ben trong

  /**
   * Ton so voi nguong. LEFT JOIN ca `products`, `medications` lan `vaccines` vi mot mat
   * hang chi la mot trong ba - COALESCE lay cai nao co, mac dinh 0 (khong dat nguong =
   * khong canh bao LOW_STOCK, nhung ton 0 van vao nhom OUT_OF_STOCK).
   *
   * `vaccines` duoc them o P9: vaccine la hang ton kho day du nghia, va bo no ra khoi
   * truy van nay se lam mot loai hang duy nhat trong he thong khong bao gio bao sap het.
   */
  private queryStockLevels(branchId?: string): Promise<InventoryAlertRow[]> {
    return this.dataSource.query(
      `
      SELECT inv."id"                                                      AS "inventoryItemId",
             item."id"                                                     AS "itemId",
             item."code"                                                   AS "itemCode",
             item."item_name"                                              AS "itemName",
             inv."branch_id"                                               AS "branchId",
             branch."branch_name"                                          AS "branchName",
             inv."inventory_quantity"                                      AS "quantity",
             COALESCE(product."minimum_stock", medication."minimum_stock",
                      vaccine."minimum_stock", 0)                          AS "minimumStock"
      FROM "inventory_items" inv
      JOIN "items" item ON item."id" = inv."item_id" AND item."deleted_at" IS NULL
      JOIN "branches" branch ON branch."id" = inv."branch_id"
      LEFT JOIN "products" product
             ON product."item_id" = item."id" AND product."deleted_at" IS NULL
      LEFT JOIN "medications" medication
             ON medication."item_id" = item."id" AND medication."deleted_at" IS NULL
      LEFT JOIN "vaccines" vaccine
             ON vaccine."item_id" = item."id" AND vaccine."deleted_at" IS NULL
      WHERE inv."deleted_at" IS NULL
        AND inv."active" = true
        AND ($1::uuid IS NULL OR inv."branch_id" = $1::uuid)
        AND inv."inventory_quantity" <= COALESCE(product."minimum_stock",
                                                 medication."minimum_stock",
                                                 vaccine."minimum_stock", 0)
      ORDER BY inv."inventory_quantity" ASC, item."item_name" ASC
      `,
      [branchId ?? null],
    );
  }

  /**
   * Lo sap het han va lo da het han, trong mot truy van.
   *
   * `daysUntilExpiry` am = da het han. Tach hai nhom o `collect()` chu khong chay hai
   * truy van: cung mot dieu kien loc, chi khac dau.
   */
  private queryExpiringBatches(branchId?: string): Promise<InventoryAlertRow[]> {
    return this.dataSource.query(
      `
      SELECT inv."id"                                        AS "inventoryItemId",
             item."id"                                       AS "itemId",
             item."code"                                     AS "itemCode",
             item."item_name"                                AS "itemName",
             inv."branch_id"                                 AS "branchId",
             branch."branch_name"                            AS "branchName",
             batch."quantity"                                AS "quantity",
             0                                               AS "minimumStock",
             batch."id"                                      AS "batchId",
             batch."batch_no"                                AS "batchNo",
             to_char(batch."expiry_date", 'YYYY-MM-DD')      AS "expiryDate",
             (batch."expiry_date" - CURRENT_DATE)            AS "daysUntilExpiry"
      FROM "inventory_batches" batch
      JOIN "inventory_items" inv ON inv."id" = batch."inventory_item_id" AND inv."deleted_at" IS NULL
      JOIN "items" item ON item."id" = inv."item_id" AND item."deleted_at" IS NULL
      JOIN "branches" branch ON branch."id" = inv."branch_id"
      WHERE batch."deleted_at" IS NULL
        AND batch."quantity" > 0
        AND batch."expiry_date" IS NOT NULL
        AND batch."expiry_date" <= CURRENT_DATE + ($2::int * INTERVAL '1 day')
        AND ($1::uuid IS NULL OR inv."branch_id" = $1::uuid)
      ORDER BY batch."expiry_date" ASC
      `,
      [branchId ?? null, this.expiringSoonDays],
    );
  }
}
