import { MigrationInterface, QueryRunner } from 'typeorm';

export class Vaccinations1796000002000 implements MigrationInterface {
  name = 'Vaccinations1796000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vaccinations" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        "deleted_at"         timestamptz,
        "pet_id"             uuid NOT NULL REFERENCES "pets"("id") ON DELETE RESTRICT,
        "vaccine_id"         uuid NOT NULL REFERENCES "vaccines"("id") ON DELETE RESTRICT,
        "medical_record_id"  uuid REFERENCES "medical_records"("id") ON DELETE SET NULL,
        "doctor_id"          uuid NOT NULL REFERENCES "doctors"("id") ON DELETE RESTRICT,
        "branch_id"          uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
        "vaccinated_at"      timestamptz NOT NULL DEFAULT now(),
        "dose_number"        integer NOT NULL DEFAULT 1,
        "batch_no"           varchar(64),
        "expiry_date"        date,
        "notes"              text,
        "next_due_date"      date,
        CONSTRAINT "chk_vaccinations_dose_number_positive" CHECK ("dose_number" >= 1)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_vaccinations_pet_date"
      ON "vaccinations" ("pet_id", "vaccinated_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_vaccinations_due"
      ON "vaccinations" ("next_due_date")
      WHERE "next_due_date" IS NOT NULL AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_vaccinations_medical_record"
      ON "vaccinations" ("medical_record_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vaccinations"`);
  }
}
