import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrescriptionStatus1793000001000 implements MigrationInterface {
  name = 'PrescriptionStatus1793000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "prescriptions_status_enum" AS ENUM (
          'PRESCRIBED', 'DISPENSING', 'DISPENSED', 'CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      ALTER TABLE "prescriptions"
        ADD COLUMN IF NOT EXISTS "status"
          "prescriptions_status_enum" NOT NULL DEFAULT 'PRESCRIBED',
        ADD COLUMN IF NOT EXISTS "dispensed_by_user_id"
          uuid REFERENCES "users"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "dispensed_at" timestamptz
    `);

    await queryRunner.query(`
      UPDATE "prescriptions" SET "status" = 'DISPENSED' WHERE "status" = 'PRESCRIBED'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prescriptions_status_created"
      ON "prescriptions" ("status", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_prescriptions_status_created"`);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
        DROP COLUMN IF EXISTS "dispensed_at",
        DROP COLUMN IF EXISTS "dispensed_by_user_id",
        DROP COLUMN IF EXISTS "status"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "prescriptions_status_enum"`);
  }
}
