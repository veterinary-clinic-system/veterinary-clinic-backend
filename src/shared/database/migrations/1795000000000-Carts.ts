import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gio hang POS - P8-T4, SRS FR-19.
 *
 * Mot mat hang chi duoc xuat hien MOT DONG trong mot gio (chi muc unique co dieu kien
 * `(cart_id, item_id)`): them lai cung mon la cong don so luong, khong phai them dong
 * thu hai. Hai dong cung mot mon tren man hinh POS la thu nhan vien phai tu cong nham
 * khi doc lai gio, va lam phep kiem tra ton kho phai gom nhom truoc khi so sanh.
 */
export class Carts1795000000000 implements MigrationInterface {
  name = 'Carts1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "carts_status_enum" AS ENUM ('OPEN', 'CHECKED_OUT', 'ABANDONED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "carts" (
        "id"                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "updated_at"           timestamptz NOT NULL DEFAULT now(),
        "deleted_at"           timestamptz,
        "branch_id"            uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
        "customer_id"          uuid REFERENCES "users"("id") ON DELETE RESTRICT,
        "staff_user_id"        uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "status"               "carts_status_enum" NOT NULL DEFAULT 'OPEN',
        "discount_amount"      bigint NOT NULL DEFAULT 0,
        "discount_by_user_id"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "discount_note"        text,
        "invoice_id"           uuid REFERENCES "invoices"("id") ON DELETE SET NULL,
        "note"                 text,
        CONSTRAINT "chk_carts_discount_non_negative" CHECK ("discount_amount" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_carts_branch_status"
      ON "carts" ("branch_id", "status")
    `);
    // Cron don gio bo do quet theo (status, updated_at) - xem `PosService.abandonStaleCarts`.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_carts_open_updated"
      ON "carts" ("updated_at") WHERE "status" = 'OPEN' AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cart_items" (
        "id"          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"  timestamptz NOT NULL DEFAULT now(),
        "updated_at"  timestamptz NOT NULL DEFAULT now(),
        "deleted_at"  timestamptz,
        "cart_id"     uuid NOT NULL REFERENCES "carts"("id") ON DELETE CASCADE,
        "item_id"     uuid NOT NULL REFERENCES "items"("id") ON DELETE RESTRICT,
        "quantity"    integer NOT NULL DEFAULT 1,
        "unit_price"  bigint NOT NULL,
        CONSTRAINT "chk_cart_items_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "chk_cart_items_unit_price_non_negative" CHECK ("unit_price" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_cart_items_cart_item"
      ON "cart_items" ("cart_id", "item_id") WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cart_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "carts"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "carts_status_enum"`);
  }
}
