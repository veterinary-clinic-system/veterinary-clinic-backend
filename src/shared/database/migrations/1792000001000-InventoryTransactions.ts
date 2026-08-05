import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * So cai xuat-nhap kho - P6-T2, SRS FR-18-02.
 *
 * Bang nay khong co `updated_at` va khong co `deleted_at` - CO CHU DICH. So cai la
 * ban ghi bat bien; mot cot `deleted_at` se khien TypeORM am tham them
 * `WHERE deleted_at IS NULL` vao moi truy van, va tu do bat bien
 * `SUM(quantity_change) = inventory_quantity` co the bi pha ma khong ai thay.
 *
 * `chk_inventory_transactions_change_not_zero`: mot dong so cai khong doi gi ca la
 * mot loi lap trinh o tang service, khong phai du lieu hop le.
 */
export class InventoryTransactions1792000001000 implements MigrationInterface {
  name = 'InventoryTransactions1792000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "inventory_transactions_type_enum" AS ENUM (
          'PURCHASE', 'SALE', 'DISPENSE', 'DAMAGED', 'EXPIRED', 'ADJUSTMENT', 'LOSS', 'RETURN'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "inventory_transactions_reference_type_enum" AS ENUM (
          'GOODS_RECEIPT', 'INVOICE', 'PRESCRIPTION', 'STOCK_TAKE', 'MANUAL'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_transactions" (
        "id"                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "inventory_item_id"    uuid NOT NULL REFERENCES "inventory_items"("id") ON DELETE CASCADE,
        "batch_id"             uuid REFERENCES "inventory_batches"("id") ON DELETE SET NULL,
        "branch_id"            uuid NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
        "type"                 "inventory_transactions_type_enum" NOT NULL,
        "quantity_change"      integer NOT NULL,
        "quantity_after"       integer NOT NULL,
        "reference_type"       "inventory_transactions_reference_type_enum" NOT NULL DEFAULT 'MANUAL',
        "reference_id"         uuid,
        "performed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "note"                 text,
        CONSTRAINT "chk_inventory_transactions_change_not_zero" CHECK ("quantity_change" <> 0),
        CONSTRAINT "chk_inventory_transactions_quantity_after_non_negative" CHECK ("quantity_after" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_inventory_transactions_item_created"
      ON "inventory_transactions" ("inventory_item_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_inventory_transactions_branch_created"
      ON "inventory_transactions" ("branch_id", "created_at" DESC)
    `);
    // Truy nguoc tu chung tu ve so cai: "phieu nhap nay da sinh ra nhung dong nao".
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_inventory_transactions_reference"
      ON "inventory_transactions" ("reference_type", "reference_id")
      WHERE "reference_id" IS NOT NULL
    `);

    // ------------------------------------------------------------------ Bat bien
    // Ton hien tai cua moi `inventory_item` phai bang tong `quantity_change` cua no.
    // Truoc phase 6 ton duoc ghi thang khong qua so cai, nen du lieu cu co ton > 0 ma
    // khong co dong nao. Sinh mot dong ADJUSTMENT "so du dau ky" cho tung dong do -
    // nho vay bat bien dung ngay tu lan chay migration nay, thay vi chi dung voi du
    // lieu tao ra sau phase 6.
    await queryRunner.query(`
      INSERT INTO "inventory_transactions"
        ("inventory_item_id", "branch_id", "type", "quantity_change", "quantity_after",
         "reference_type", "note")
      SELECT "id", "branch_id", 'ADJUSTMENT', "inventory_quantity", "inventory_quantity",
             'MANUAL', 'So du dau ky truoc khi ap dung so cai kho (P6-T2)'
      FROM "inventory_items"
      WHERE "inventory_quantity" <> 0 AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_transactions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "inventory_transactions_reference_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "inventory_transactions_type_enum"`);
  }
}
