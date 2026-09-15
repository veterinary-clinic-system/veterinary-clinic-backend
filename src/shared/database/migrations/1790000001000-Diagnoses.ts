import { MigrationInterface, QueryRunner } from 'typeorm';

export class Diagnoses1790000001000 implements MigrationInterface {
  name = 'Diagnoses1790000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "diagnoses_severity_enum" AS ENUM
          ('MILD', 'MODERATE', 'SEVERE', 'CRITICAL');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "diagnoses" (
        "id"                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        "deleted_at"        timestamptz,
        "medical_record_id" uuid NOT NULL REFERENCES "medical_records"("id") ON DELETE CASCADE,
        "disease_id"        uuid REFERENCES "diseases"("id") ON DELETE SET NULL,
        "diagnosis_text"    text NOT NULL,
        "severity"          "diagnoses_severity_enum" NOT NULL DEFAULT 'MILD',
        "notes"             text,
        "is_primary"        boolean NOT NULL DEFAULT false
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_diagnoses_medical_record"
      ON "diagnoses" ("medical_record_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_diagnoses_one_primary"
      ON "diagnoses" ("medical_record_id")
      WHERE "is_primary" AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO "diagnoses"
        ("medical_record_id", "disease_id", "diagnosis_text", "is_primary", "created_at")
      SELECT m."id",
             d."id",
             g."name",
             g."ord" = 1,
             e."created_at"
        FROM "examinations" e
        JOIN "medical_records" m ON m."id" = e."medical_record_id"
        CROSS JOIN LATERAL unnest(e."disease_groups") WITH ORDINALITY AS g("name", "ord")
        LEFT JOIN "diseases" d ON lower(d."disease_name") = lower(g."name")
       WHERE e."deleted_at" IS NULL
         AND NOT EXISTS (SELECT 1 FROM "diagnoses" x WHERE x."medical_record_id" = m."id")
    `);

    await queryRunner.query(`
      INSERT INTO "diagnoses"
        ("medical_record_id", "diagnosis_text", "is_primary", "created_at")
      SELECT m."id", e."diagnosis_text", true, e."created_at"
        FROM "examinations" e
        JOIN "medical_records" m ON m."id" = e."medical_record_id"
       WHERE e."deleted_at" IS NULL
         AND COALESCE(array_length(e."disease_groups", 1), 0) = 0
         AND e."diagnosis_text" IS NOT NULL
         AND btrim(e."diagnosis_text") <> ''
         AND NOT EXISTS (SELECT 1 FROM "diagnoses" x WHERE x."medical_record_id" = m."id")
    `);

    await queryRunner.query(`
      UPDATE "diagnoses" x
         SET "notes" = e."diagnosis_text"
        FROM "examinations" e
       WHERE e."medical_record_id" = x."medical_record_id"
         AND x."is_primary"
         AND x."notes" IS NULL
         AND COALESCE(array_length(e."disease_groups", 1), 0) > 0
         AND e."diagnosis_text" IS NOT NULL
         AND btrim(e."diagnosis_text") <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "diagnoses"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "diagnoses_severity_enum"`);
  }
}
