import { MigrationInterface, QueryRunner } from 'typeorm';

export class PurchaseOrders1792000002000 implements MigrationInterface {
  name = 'PurchaseOrders1792000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "purchase_orders_status_enum" AS ENUM (
          'DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_orders" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        "deleted_at"         timestamptz,
        "po_code"            varchar(32) NOT NULL,
        "supplier_id"        uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE RESTRICT,
        "branch_id"          uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
        "status"             "purchase_orders_status_enum" NOT NULL DEFAULT 'DRAFT',
        "order_date"         date NOT NULL DEFAULT CURRENT_DATE,
        "expected_date"      date,
        "total_amount"       bigint NOT NULL DEFAULT 0,
        "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "note"               text,
        CONSTRAINT "chk_purchase_orders_total_non_negative" CHECK ("total_amount" >= 0)
      )
    `);

    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "purchase_order_code_seq" START 1`);
    await queryRunner.query(`
      ALTER TABLE "purchase_orders"
        ALTER COLUMN "po_code"
        SET DEFAULT 'PO' || LPAD(nextval('purchase_order_code_seq')::text, 5, '0')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_purchase_orders_po_code"
      ON "purchase_orders" ("po_code") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_purchase_orders_branch_status"
      ON "purchase_orders" ("branch_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_order_items" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        "deleted_at"         timestamptz,
        "purchase_order_id"  uuid NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
        "item_id"            uuid NOT NULL REFERENCES "items"("id") ON DELETE RESTRICT,
        "quantity"           integer NOT NULL,
        "unit_cost"          bigint NOT NULL DEFAULT 0,
        "received_quantity"  integer NOT NULL DEFAULT 0,
        CONSTRAINT "chk_purchase_order_items_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "chk_purchase_order_items_unit_cost_non_negative" CHECK ("unit_cost" >= 0),
        CONSTRAINT "chk_purchase_order_items_received_non_negative" CHECK ("received_quantity" >= 0),
        CONSTRAINT "chk_purchase_order_items_received_not_exceeding"
          CHECK ("received_quantity" <= "quantity")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_purchase_order_items_order"
      ON "purchase_order_items" ("purchase_order_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_purchase_order_items_order_item"
      ON "purchase_order_items" ("purchase_order_id", "item_id") WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_orders"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "purchase_order_code_seq"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "purchase_orders_status_enum"`);
  }
}
