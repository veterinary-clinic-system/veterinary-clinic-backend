import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bo sung truong danh muc cho thuoc - SRS FR-15.
 *
 * `code` va `category_id` da co tu `1791000002000-ItemCodeAndCategory` (dat o `items`,
 * dung chung cho ca ba loai) nen o day chi con nam truong rieng cua thuoc.
 *
 * KHONG them `batch_number`/`expiry_date`: mot loai thuoc co nhieu lo cung luc, moi lo
 * mot han va mot so luong. Hai cot o day chi giu duoc mot lo va se sai ngay dot nhap
 * thu hai - do la viec cua `InventoryBatch` o P6.
 *
 * `supplier_id` dung ON DELETE SET NULL: ngung hop tac voi mot nha cung cap khong duoc
 * lam bien mat thuoc khoi danh muc (va khong duoc lam vo don thuoc cu tro toi thuoc do).
 */
export class MedicationCatalogFields1791000004000 implements MigrationInterface {
  name = 'MedicationCatalogFields1791000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "medications"
        ADD COLUMN IF NOT EXISTS "generic_name"  varchar(255),
        ADD COLUMN IF NOT EXISTS "manufacturer"  varchar(255),
        ADD COLUMN IF NOT EXISTS "supplier_id"   uuid REFERENCES "suppliers"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "cost_price"    bigint NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "minimum_stock" int NOT NULL DEFAULT 0
    `);

    // Cung khuon voi `chk_products_cost_price_non_negative` va
    // `chk_items_unit_price_non_negative` da co san.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "medications"
          ADD CONSTRAINT "chk_medications_cost_price_non_negative" CHECK ("cost_price" >= 0);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "medications"
          ADD CONSTRAINT "chk_medications_minimum_stock_non_negative" CHECK ("minimum_stock" >= 0);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_medications_supplier" ON "medications" ("supplier_id")
    `);
    // Duoc si tim thuoc thay the theo ten goc - NFR-02.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_medications_generic_name" ON "medications" ("generic_name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_medications_generic_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_medications_supplier"`);
    await queryRunner.query(`
      ALTER TABLE "medications"
        DROP CONSTRAINT IF EXISTS "chk_medications_minimum_stock_non_negative",
        DROP CONSTRAINT IF EXISTS "chk_medications_cost_price_non_negative",
        DROP COLUMN IF EXISTS "minimum_stock",
        DROP COLUMN IF EXISTS "cost_price",
        DROP COLUMN IF EXISTS "supplier_id",
        DROP COLUMN IF EXISTS "manufacturer",
        DROP COLUMN IF EXISTS "generic_name"
    `);
  }
}
