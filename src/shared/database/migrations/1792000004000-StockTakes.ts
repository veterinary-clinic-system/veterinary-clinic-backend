import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kiem ke - P6-T6, SRS FR-18-03.
 *
 * `counted_quantity` nullable: phieu duoc tao truoc, nhan vien dem dan tung dong. NULL
 * nghia la "chua dem", khac han voi 0 nghia la "dem duoc khong con cai nao" - gop hai
 * cai nay lai thi mot phieu dem do dang se bien moi dong chua dem thanh that thoat toan
 * bo. Xac nhan phieu bo qua cac dong con NULL.
 *
 * `uq_stock_take_items_take_inventory`: mot dong ton kho chi duoc dem mot lan tren mot
 * phieu. Hai dong cho cung mot mat hang thi khong biet lay so nao lam so dem.
 */
export class StockTakes1792000004000 implements MigrationInterface {
  name = 'StockTakes1792000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "stock_takes_status_enum" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN null; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_takes" (
        "id"                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"            timestamptz NOT NULL DEFAULT now(),
        "updated_at"            timestamptz NOT NULL DEFAULT now(),
        "deleted_at"            timestamptz,
        "stock_take_code"       varchar(32) NOT NULL,
        "branch_id"             uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
        "status"                "stock_takes_status_enum" NOT NULL DEFAULT 'DRAFT',
        "taken_date"            date NOT NULL DEFAULT CURRENT_DATE,
        "created_by_user_id"    uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "confirmed_by_user_id"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "confirmed_at"          timestamptz,
        "note"                  text
      )
    `);

    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "stock_take_code_seq" START 1`);
    await queryRunner.query(`
      ALTER TABLE "stock_takes"
        ALTER COLUMN "stock_take_code"
        SET DEFAULT 'KK' || LPAD(nextval('stock_take_code_seq')::text, 5, '0')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_stock_takes_code"
      ON "stock_takes" ("stock_take_code") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_stock_takes_branch_status"
      ON "stock_takes" ("branch_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_take_items" (
        "id"                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        "deleted_at"        timestamptz,
        "stock_take_id"     uuid NOT NULL REFERENCES "stock_takes"("id") ON DELETE CASCADE,
        "inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id") ON DELETE CASCADE,
        "item_id"           uuid NOT NULL REFERENCES "items"("id") ON DELETE RESTRICT,
        "system_quantity"   integer NOT NULL,
        "counted_quantity"  integer,
        "note"              text,
        CONSTRAINT "chk_stock_take_items_counted_non_negative"
          CHECK ("counted_quantity" IS NULL OR "counted_quantity" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_stock_take_items_stock_take"
      ON "stock_take_items" ("stock_take_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_stock_take_items_take_inventory"
      ON "stock_take_items" ("stock_take_id", "inventory_item_id") WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_take_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_takes"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "stock_take_code_seq"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "stock_takes_status_enum"`);
  }
}
