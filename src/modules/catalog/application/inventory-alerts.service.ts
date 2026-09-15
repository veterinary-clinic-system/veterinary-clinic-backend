import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxService, StaffNotificationsService } from '@/modules/notification/application';
import { StaffNotificationType } from '@/shared/common/enums/staff-notification.enum';
import { toDateOnly } from '@/modules/catalog/domain/inventory-allocation.util';

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

const STAFF_NOTIFICATION_TYPE: Record<InventoryAlertKind, StaffNotificationType> = {
  LOW_STOCK: StaffNotificationType.LOW_STOCK,
  OUT_OF_STOCK: StaffNotificationType.OUT_OF_STOCK,
  EXPIRING_SOON: StaffNotificationType.EXPIRING_SOON,
  EXPIRED: StaffNotificationType.EXPIRED,
};

function alertTitle(row: InventoryAlertRow): string {
  return `${row.itemName} (${row.itemCode})`;
}

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

  async collect(branchId?: string): Promise<InventoryAlerts> {
    const [stockRows, expiryRows] = await Promise.all([
      this.queryStockLevels(branchId),
      this.queryExpiringBatches(branchId),
    ]);

    return {

      outOfStock: stockRows.filter((row) => row.quantity === 0),
      lowStock: stockRows.filter((row) => row.quantity > 0 && row.quantity <= row.minimumStock),
      expiringSoon: expiryRows.filter((row) => (row.daysUntilExpiry ?? 0) >= 0),
      expired: expiryRows.filter((row) => (row.daysUntilExpiry ?? 0) < 0),
    };
  }

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

    await this.dataSource.transaction(async (em) => {
      for (const event of events) {
        const scope = event.row.batchId ?? event.row.inventoryItemId;
        const dedupeKey = `inv-alert:${event.kind}:${scope}:${today}`;

        await this.outboxService.record(em, {
          type: `INVENTORY_${event.kind}`,
          payload: { ...event.row, kind: event.kind, detectedOn: today },
          dedupeKey,
        });

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
