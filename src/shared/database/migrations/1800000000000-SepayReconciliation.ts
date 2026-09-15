import { MigrationInterface, QueryRunner } from 'typeorm';

export class SepayReconciliation1800000000000 implements MigrationInterface {
  name = 'SepayReconciliation1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "staff_notifications_type_enum" ADD VALUE IF NOT EXISTS 'PAYMENT_RECEIVED'
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "sepay_transactions_status_enum" AS ENUM ('MATCHED', 'NEEDS_REVIEW', 'IGNORED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sepay_transactions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "provider_transaction_id" varchar(64) NOT NULL,
        "gateway" varchar(64),
        "bank_reference" varchar(128),
        "account_number" varchar(32),
        "transaction_date" timestamptz,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        "transfer_amount" bigint NOT NULL CHECK ("transfer_amount" > 0),
        "content" text,
        "status" "sepay_transactions_status_enum" NOT NULL,
        "review_reason" varchar(64),
        "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE SET NULL,
        "payment_id" uuid REFERENCES "payments"("id") ON DELETE SET NULL,
        "reviewed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "reviewed_at" timestamptz,
        "raw_payload" jsonb NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_sepay_transactions_provider_id"
      ON "sepay_transactions" ("provider_transaction_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sepay_transactions_status_received"
      ON "sepay_transactions" ("status", "received_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sepay_transactions_status_received"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_sepay_transactions_provider_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sepay_transactions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sepay_transactions_status_enum"`);
  }
}
