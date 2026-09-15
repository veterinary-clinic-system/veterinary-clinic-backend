import { MigrationInterface, QueryRunner } from 'typeorm';

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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_inventory_batches_fefo"
      ON "inventory_batches" ("inventory_item_id", "expiry_date")
      WHERE "deleted_at" IS NULL AND "quantity" > 0
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_inventory_batches_expiry"
      ON "inventory_batches" ("expiry_date")
      WHERE "deleted_at" IS NULL AND "quantity" > 0 AND "expiry_date" IS NOT NULL
    `);

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
