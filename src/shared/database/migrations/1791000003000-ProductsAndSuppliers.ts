import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductsAndSuppliers1791000003000 implements MigrationInterface {
  name = 'ProductsAndSuppliers1791000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id"            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        "deleted_at"    timestamptz,
        "item_id"       uuid NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
        "sku"           varchar(64) NOT NULL,
        "brand"         varchar(255),
        "unit"          varchar(50) NOT NULL,
        "cost_price"    bigint NOT NULL DEFAULT 0,
        "minimum_stock" int NOT NULL DEFAULT 0,
        "active"        boolean NOT NULL DEFAULT true,
        CONSTRAINT "chk_products_cost_price_non_negative" CHECK ("cost_price" >= 0),
        CONSTRAINT "chk_products_minimum_stock_non_negative" CHECK ("minimum_stock" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_products_sku"
      ON "products" ("sku") WHERE "deleted_at" IS NULL
    `);
    
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_products_item"
      ON "products" ("item_id") WHERE "deleted_at" IS NULL
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_products_sku" ON "products" ("sku")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "suppliers" (
        "id"             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"     timestamptz NOT NULL DEFAULT now(),
        "updated_at"     timestamptz NOT NULL DEFAULT now(),
        "deleted_at"     timestamptz,
        "supplier_code"  varchar(32) NOT NULL,
        "name"           varchar(255) NOT NULL,
        "phone"          varchar(20),
        "email"          varchar(255),
        "address"        text,
        "contact_person" varchar(255),
        "tax_code"       varchar(32),
        "active"         boolean NOT NULL DEFAULT true,
        "note"           text
      )
    `);

    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "supplier_code_seq" START 1`);
    await queryRunner.query(`
      ALTER TABLE "suppliers"
        ALTER COLUMN "supplier_code"
        SET DEFAULT 'NCC' || LPAD(nextval('supplier_code_seq')::text, 4, '0')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_suppliers_supplier_code"
      ON "suppliers" ("supplier_code") WHERE "deleted_at" IS NULL
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_suppliers_name" ON "suppliers" ("name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "supplier_code_seq"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
  }
}
