import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lo hang - P6-T1, SRS FR-18-01, BR-11, NFR-07.
 *
 * `chk_inventory_batches_quantity_non_negative` la rang buoc quan trong nhat cua ca
 * phase 6. NFR-07 noi "ton kho khong duoc am"; tang service da kiem tra dieu do,
 * nhung service khong phai duong duy nhat vao CSDL - script nhap lieu, migration ve
 * sau, va sua tay qua psql deu di vong qua no. Mot lo am se lam lech so tong, va vi
 * so tong la cai POS doc de ban hang, lech o day nghia la ban duoc thu khong co.
 *
 * `uq_inventory_batches_item_batch_no` partial theo `deleted_at IS NULL` - cung quy
 * uoc voi `uq_products_sku`: xoa mem mot lo nhap sai roi nhap lai dung ma lo do phai
 * duoc phep.
 *
 * `goods_receipt_id` co o day nhung CHUA co khoa ngoai: bang `goods_receipts` ra doi
 * o P6-T5 va migration cua task do se them rang buoc. Tach nhu vay de moi task deu
 * chay duoc doc lap.
 */
export class InventoryBatches1792000000000 implements MigrationInterface {
  name = 'InventoryBatches1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_batches" (
        "id"                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        "deleted_at"        timestamptz,
        "inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id") ON DELETE CASCADE,
        "batch_no"          varchar(64) NOT NULL,
        "expiry_date"       date,
        "quantity"          integer NOT NULL DEFAULT 0,
        "cost_price"        bigint NOT NULL DEFAULT 0,
        "received_at"       timestamptz NOT NULL DEFAULT now(),
        "supplier_id"       uuid REFERENCES "suppliers"("id") ON DELETE SET NULL,
        "goods_receipt_id"  uuid,
        CONSTRAINT "chk_inventory_batches_quantity_non_negative" CHECK ("quantity" >= 0),
        CONSTRAINT "chk_inventory_batches_cost_price_non_negative" CHECK ("cost_price" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_inventory_batches_item_batch_no"
      ON "inventory_batches" ("inventory_item_id", "batch_no") WHERE "deleted_at" IS NULL
    `);

    // Truy van nong nhat cua phase 6: FEFO doc cac lo con hang cua mot item, sap theo
    // han dung. Partial theo `quantity > 0` de chi muc chi chua lo con dung duoc - lo
    // da xuat het van phai giu lai lam lich su nhung khong bao gio duoc FEFO chon.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_inventory_batches_fefo"
      ON "inventory_batches" ("inventory_item_id", "expiry_date")
      WHERE "deleted_at" IS NULL AND "quantity" > 0
    `);

    // Canh bao "sap het han" (P6-T7) quet theo han dung tren toan he thong.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_inventory_batches_expiry"
      ON "inventory_batches" ("expiry_date")
      WHERE "deleted_at" IS NULL AND "quantity" > 0 AND "expiry_date" IS NOT NULL
    `);

    // So tong cung phai chiu dung luat voi lo. `inventory_items` co truoc phase 6 va
    // chua he co rang buoc nay - them o day de ca hai ve cua quyet dinh (B) (so tong
    // la ban cache cua tong cac lo) khong the roi vao trang thai am.
    await queryRunner.query(`
      ALTER TABLE "inventory_items"
        ADD CONSTRAINT "chk_inventory_items_quantity_non_negative"
        CHECK ("inventory_quantity" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_items" DROP CONSTRAINT IF EXISTS "chk_inventory_items_quantity_non_negative"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_batches"`);
  }
}
