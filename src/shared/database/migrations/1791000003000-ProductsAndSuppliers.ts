import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hang hoa ban le va nha cung cap - SRS FR-16, FR-17.
 *
 * Hai bang trong mot migration vi chung ra doi cung luc va khong bang nao tham chieu
 * bang nao - tach ra chi de them mot file phai doc.
 *
 * `chk_products_cost_price_non_negative` lap o tang CSDL luat ma DTO da kiem, cung
 * khuon voi `chk_items_unit_price_non_negative` da co san tren `items`. Ly do khong
 * chi tin vao DTO: script nhap lieu, migration ve sau va sua tay qua psql deu khong
 * di qua ValidationPipe, ma mot gia von am se lam moi bao cao loi nhuan sai dau.
 *
 * `sku` KHONG unique tuyet doi ma partial theo `deleted_at IS NULL` - cung quy uoc
 * voi `uq_items_code`: san pham ngung kinh doanh khong giu cho ma cua no mai mai.
 */
export class ProductsAndSuppliers1791000003000 implements MigrationInterface {
  name = 'ProductsAndSuppliers1791000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------------- Products
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

    // SRS muc 16: "SKU khong duoc trung".
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_products_sku"
      ON "products" ("sku") WHERE "deleted_at" IS NULL
    `);
    // 1:1 that su voi Item - mot item khong the co hai ho so san pham.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_products_item"
      ON "products" ("item_id") WHERE "deleted_at" IS NULL
    `);
    // NFR-02: tim theo SKU phai nhanh ke ca khi hang da ngung kinh doanh.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_products_sku" ON "products" ("sku")
    `);

    // --------------------------------------------------------------------- Suppliers
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

    // Cap ma bang cot DEFAULT (khong can trigger nhu `items.code`): moi dong trong bang
    // nay deu la mot nha cung cap nen luon cung mot tien to.
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
    // Man hinh nha cung cap tim theo ten la chinh.
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
