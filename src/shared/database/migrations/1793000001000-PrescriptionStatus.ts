import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vong doi don thuoc - P7-T2, SRS FR-11-03.
 *
 * BACKFILL DON CU -> `DISPENSED`, khong phai `PRESCRIBED`. Ly do: tren thuc te thuoc da
 * duoc phat cho khach roi, chi la he thong khong ghi lai buoc do. Neu de `PRESCRIBED`
 * thi ngay sau khi deploy, quay thuoc se thay mot hang cho gia gom toan bo don thuoc
 * trong lich su - va neu ai do bam "cap phat" thi kho bi tru mot lan nua cho so thuoc
 * da giao tu lau.
 *
 * `dispensed_by_user_id` va `dispensed_at` de NULL cho don cu: khong co du lieu that de
 * dien, va bia mot moc thoi gian se lam bao cao cua P10 sai. NULL o day doc duoc dung
 * la "da phat truoc khi he thong theo doi buoc nay".
 */
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

    // Don co truoc P7 = thuoc da phat roi - xem comment dau lop.
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
