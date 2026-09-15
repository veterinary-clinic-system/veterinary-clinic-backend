import { MigrationInterface, QueryRunner } from 'typeorm';

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
