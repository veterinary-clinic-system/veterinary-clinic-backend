import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrescriptionAndLabToMedicalRecord1790000003000 implements MigrationInterface {
  name = 'PrescriptionAndLabToMedicalRecord1790000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    
    await queryRunner.query(`
      INSERT INTO "medical_records"
        ("appointment_id", "pet_id", "doctor_id", "visit_reason", "notes",
         "status", "completed_at", "created_at", "deleted_at")
      SELECT e."appointment_id",
             a."pet_id",
             e."doctor_id",
             a."other_symptoms",
             e."notes",
             'COMPLETED'::"medical_records_status_enum",
             e."examined_at",
             e."created_at",
             e."deleted_at"
        FROM "examinations" e
        JOIN "appointments" a ON a."id" = e."appointment_id"
       WHERE e."deleted_at" IS NOT NULL
         AND e."medical_record_id" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "examinations" e
         SET "medical_record_id" = m."id"
        FROM "medical_records" m
       WHERE m."appointment_id" = e."appointment_id"
         AND e."medical_record_id" IS NULL
    `);

    for (const table of ['prescriptions', 'lab_test_orders']) {
      
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "medical_record_id" uuid`,
      );

      await queryRunner.query(`
        UPDATE "${table}" t
           SET "medical_record_id" = e."medical_record_id"
          FROM "examinations" e
         WHERE e."id" = t."examination_id"
           AND t."medical_record_id" IS NULL
      `);

      const orphans: Array<{ count: number }> = await queryRunner.query(
        `SELECT count(*)::int AS "count" FROM "${table}" WHERE "medical_record_id" IS NULL`,
      );
      if (orphans[0].count > 0) {
        throw new Error(
          `${table}: ${orphans[0].count} hàng không tìm được hồ sơ bệnh án tương ứng ` +
            `(examination_id trỏ tới phiếu khám không tồn tại). Dừng migration để không mất dữ liệu.`,
        );
      }

      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "medical_record_id" SET NOT NULL`,
      );
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "${table}"
            ADD CONSTRAINT "fk_${table}_medical_record"
            FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "idx_${table}_medical_record"
        ON "${table}" ("medical_record_id")
      `);

      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "examination_id"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['prescriptions', 'lab_test_orders']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "examination_id" uuid`,
      );
      await queryRunner.query(`
        UPDATE "${table}" t
           SET "examination_id" = e."id"
          FROM "examinations" e
         WHERE e."medical_record_id" = t."medical_record_id"
           AND t."examination_id" IS NULL
      `);

      await queryRunner.query(`DELETE FROM "${table}" WHERE "examination_id" IS NULL`);

      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "examination_id" SET NOT NULL`);
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE "${table}"
            ADD CONSTRAINT "fk_${table}_examination"
            FOREIGN KEY ("examination_id") REFERENCES "examinations"("id") ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
      `);

      await queryRunner.query(`DROP INDEX IF EXISTS "idx_${table}_medical_record"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "fk_${table}_medical_record"`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "medical_record_id"`);
    }
  }
}
