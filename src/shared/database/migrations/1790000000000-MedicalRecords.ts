import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ho so benh an - SRS FR-07, aggregate root cua nhanh phong kham.
 *
 * Chien luoc Hybrid (docs/plan/README.md): KHONG tach `examinations` ra. Bang do giu
 * nguyen vai "phan sinh hieu"; `medical_records` la lop boc ben ngoai mang vong doi
 * DRAFT/COMPLETED ma BR-08 bao ve.
 *
 * `pet_id` duoc denormalise tu `appointments.pet_id`: moi truy van benh su cua mot con
 * vat deu di qua day, join nguoc qua appointments moi lan la lang phi.
 *
 * BACKFILL: moi phieu kham dang co sinh ra dung mot ho so `COMPLETED` - chung la
 * nhung lan kham DA XONG, khong con la ban nhap. `visit_reason` lay tu
 * `appointments.other_symptoms` (loi khach ke luc dat lich) vi do la thu gan nhat voi
 * "ly do kham" ma du lieu cu co; `general_condition` de trong - bia ra mot tinh trang
 * chung cho ho so cu la tao du lieu y te gia.
 */
export class MedicalRecords1790000000000 implements MigrationInterface {
  name = 'MedicalRecords1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "medical_records_status_enum" AS ENUM ('DRAFT', 'COMPLETED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "medical_records" (
        "id"                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        "deleted_at"        timestamptz,
        "appointment_id"    uuid NOT NULL REFERENCES "appointments"("id") ON DELETE RESTRICT,
        "pet_id"            uuid NOT NULL REFERENCES "pets"("id")         ON DELETE RESTRICT,
        "doctor_id"         uuid NOT NULL REFERENCES "doctors"("id")      ON DELETE RESTRICT,
        "visit_reason"      text,
        "general_condition" text,
        "notes"             text,
        "status"            "medical_records_status_enum" NOT NULL DEFAULT 'DRAFT',
        "completed_at"      timestamptz
      )
    `);

    // Mot lich hen chi co dung mot ho so benh an (partial: ho so xoa mem khong giu cho).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_medical_records_appointment"
      ON "medical_records" ("appointment_id") WHERE "deleted_at" IS NULL
    `);
    // Truy van benh su: "moi ho so cua con nay, moi nhat truoc".
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_medical_records_pet_created"
      ON "medical_records" ("pet_id", "created_at" DESC)
    `);

    await queryRunner.query(
      `ALTER TABLE "examinations" ADD COLUMN IF NOT EXISTS "medical_record_id" uuid`,
    );

    // ---------------------------------------------------------------------------------
    // Backfill
    // ---------------------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO "medical_records"
        ("appointment_id", "pet_id", "doctor_id", "visit_reason", "notes",
         "status", "completed_at", "created_at")
      SELECT e."appointment_id",
             a."pet_id",
             e."doctor_id",
             a."other_symptoms",
             e."notes",
             'COMPLETED'::"medical_records_status_enum",
             e."examined_at",
             e."created_at"
        FROM "examinations" e
        JOIN "appointments" a ON a."id" = e."appointment_id"
       WHERE e."deleted_at" IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM "medical_records" m
            WHERE m."appointment_id" = e."appointment_id" AND m."deleted_at" IS NULL
         )
    `);

    await queryRunner.query(`
      UPDATE "examinations" e
         SET "medical_record_id" = m."id"
        FROM "medical_records" m
       WHERE m."appointment_id" = e."appointment_id"
         AND e."medical_record_id" IS NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "examinations"
          ADD CONSTRAINT "fk_examinations_medical_record"
          FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    // 1:1 that su - mot ho so khong the co hai phieu sinh hieu.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_examinations_medical_record"
      ON "examinations" ("medical_record_id")
      WHERE "deleted_at" IS NULL AND "medical_record_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_examinations_medical_record"`);
    await queryRunner.query(
      `ALTER TABLE "examinations" DROP CONSTRAINT IF EXISTS "fk_examinations_medical_record"`,
    );
    await queryRunner.query(`ALTER TABLE "examinations" DROP COLUMN IF EXISTS "medical_record_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "medical_records"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "medical_records_status_enum"`);
  }
}
