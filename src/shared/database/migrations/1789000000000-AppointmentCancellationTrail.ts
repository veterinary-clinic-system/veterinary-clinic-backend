import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentCancellationTrail1789000000000 implements MigrationInterface {
  name = 'AppointmentCancellationTrail1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
        ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" uuid,
        ADD COLUMN IF NOT EXISTS "cancelled_at"         timestamptz,
        ADD COLUMN IF NOT EXISTS "cancel_reason"        text
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "appointments"
          ADD CONSTRAINT "fk_appointments_cancelled_by_user"
          FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appointments_cancelled_at"
      ON "appointments" ("cancelled_at") WHERE "cancelled_at" IS NOT NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "queue_entries" ADD COLUMN IF NOT EXISTS "cancel_reason" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "queue_entries" DROP COLUMN IF EXISTS "cancel_reason"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_appointments_cancelled_at"`);
    await queryRunner.query(`
      ALTER TABLE "appointments"
        DROP CONSTRAINT IF EXISTS "fk_appointments_cancelled_by_user",
        DROP COLUMN IF EXISTS "cancel_reason",
        DROP COLUMN IF EXISTS "cancelled_at",
        DROP COLUMN IF EXISTS "cancelled_by_user_id"
    `);
  }
}
