import { MigrationInterface, QueryRunner } from 'typeorm';

export class Payments1794000001000 implements MigrationInterface {
  name = 'Payments1794000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`
      ALTER TYPE "invoices_payment_method_enum" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER'
    `);
    await queryRunner.query(`
      ALTER TYPE "invoices_payment_method_enum" ADD VALUE IF NOT EXISTS 'QR'
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payments_method_enum" AS ENUM (
          'CASH', 'E_WALLET', 'CREDIT_CARD', 'BANK_TRANSFER', 'QR'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payments_status_enum" AS ENUM (
          'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id"                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "updated_at"           timestamptz NOT NULL DEFAULT now(),
        "deleted_at"           timestamptz,
        "invoice_id"           uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
        "amount"               bigint NOT NULL,
        "method"               "payments_method_enum" NOT NULL,
        "status"               "payments_status_enum" NOT NULL DEFAULT 'PENDING',
        "paid_at"              timestamptz,
        "reference_code"       varchar(128),
        "received_by_user_id"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "note"                 text,
        -- Dau cua so tien PHAI khop trang thai: dong hoan tien am, dong thu tien duong.
        -- Mot dong REFUNDED mang so duong se lam tong thu tien tang len khi hoan tien.
        CONSTRAINT "chk_payments_amount_sign" CHECK (
          ("status" = 'REFUNDED' AND "amount" < 0)
          OR ("status" <> 'REFUNDED' AND "amount" > 0)
        )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payments_invoice_created"
      ON "payments" ("invoice_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_payments_status_paid_at"
      ON "payments" ("status", "paid_at" DESC) WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "invoices_status_enum" AS ENUM (
          'PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REFUNDED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD COLUMN IF NOT EXISTS "status" "invoices_status_enum" NOT NULL DEFAULT 'PENDING'
    `);

    await queryRunner.query(`
      INSERT INTO "payments" (
        "invoice_id", "amount", "method", "status", "paid_at", "note", "created_at"
      )
      SELECT i."id",
             i."total_amount",
             COALESCE(i."payment_method"::text, 'CASH')::"payments_method_enum",
             'SUCCESS',
             COALESCE(i."paid_at", i."updated_at"),
             'Backfill P8-T2: thanh toan ghi nhan truoc khi he thong tach bang payments',
             COALESCE(i."paid_at", i."updated_at")
      FROM "invoices" i
      WHERE i."paid" = true
        AND i."deleted_at" IS NULL
        AND i."total_amount" > 0
    `);

    await queryRunner.query(`
      UPDATE "invoices" SET "status" = 'PAID' WHERE "paid" = true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoices_status_created"
      ON "invoices" ("status", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoices_status_created"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "invoices_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_method_enum"`);

  }
}
