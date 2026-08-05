import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phieu nhap kho - P6-T5, SRS UC-05, BR-13.
 *
 * Day cung la noi dong `inventory_batches.goods_receipt_id` (tao o P6-T1 duoi dang uuid
 * tran) nhan khoa ngoai cua no - bang `goods_receipts` toi bay gio moi ton tai.
 */
export class GoodsReceipts1792000003000 implements MigrationInterface {
  name = 'GoodsReceipts1792000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "goods_receipts" (
        "id"                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now(),
        "deleted_at"          timestamptz,
        "receipt_code"        varchar(32) NOT NULL,
        "purchase_order_id"   uuid REFERENCES "purchase_orders"("id") ON DELETE SET NULL,
        "supplier_id"         uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE RESTRICT,
        "branch_id"           uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
        "received_date"       date NOT NULL DEFAULT CURRENT_DATE,
        "total_amount"        bigint NOT NULL DEFAULT 0,
        "received_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "note"                text,
        CONSTRAINT "chk_goods_receipts_total_non_negative" CHECK ("total_amount" >= 0)
      )
    `);

    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "goods_receipt_code_seq" START 1`);
    await queryRunner.query(`
      ALTER TABLE "goods_receipts"
        ALTER COLUMN "receipt_code"
        SET DEFAULT 'GR' || LPAD(nextval('goods_receipt_code_seq')::text, 5, '0')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_goods_receipts_receipt_code"
      ON "goods_receipts" ("receipt_code") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_goods_receipts_branch_received"
      ON "goods_receipts" ("branch_id", "received_date" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_goods_receipts_purchase_order"
      ON "goods_receipts" ("purchase_order_id") WHERE "purchase_order_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "goods_receipt_items" (
        "id"                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"              timestamptz NOT NULL DEFAULT now(),
        "updated_at"              timestamptz NOT NULL DEFAULT now(),
        "deleted_at"              timestamptz,
        "goods_receipt_id"        uuid NOT NULL REFERENCES "goods_receipts"("id") ON DELETE CASCADE,
        "purchase_order_item_id"  uuid REFERENCES "purchase_order_items"("id") ON DELETE SET NULL,
        "item_id"                 uuid NOT NULL REFERENCES "items"("id") ON DELETE RESTRICT,
        "quantity"                integer NOT NULL,
        "unit_cost"               bigint NOT NULL DEFAULT 0,
        "batch_no"                varchar(64) NOT NULL,
        "expiry_date"             date,
        "batch_id"                uuid REFERENCES "inventory_batches"("id") ON DELETE SET NULL,
        CONSTRAINT "chk_goods_receipt_items_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "chk_goods_receipt_items_unit_cost_non_negative" CHECK ("unit_cost" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_goods_receipt_items_receipt"
      ON "goods_receipt_items" ("goods_receipt_id")
    `);

    // Khoa ngoai da hen o P6-T1: lo hang tro ve phieu nhap da sinh ra no.
    await queryRunner.query(`
      ALTER TABLE "inventory_batches"
        ADD CONSTRAINT "fk_inventory_batches_goods_receipt"
        FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_batches" DROP CONSTRAINT IF EXISTS "fk_inventory_batches_goods_receipt"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "goods_receipt_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "goods_receipts"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "goods_receipt_code_seq"`);
  }
}
