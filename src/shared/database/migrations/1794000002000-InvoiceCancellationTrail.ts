import { MigrationInterface, QueryRunner } from 'typeorm';

export class InvoiceCancellationTrail1794000002000 implements MigrationInterface {
  name = 'InvoiceCancellationTrail1794000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD COLUMN IF NOT EXISTS "cancel_reason" text,
        ADD COLUMN IF NOT EXISTS "cancelled_at"  timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
        DROP COLUMN IF EXISTS "cancelled_at",
        DROP COLUMN IF EXISTS "cancel_reason"
    `);
  }
}
