import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chan doan - SRS FR-09.
 *
 * BACKFILL - phan dang chu y nhat cua migration nay. Du lieu cu nam o hai cho:
 *   - `examinations.disease_groups: text[]` - danh sach nhom benh bac si chon
 *   - `examinations.diagnosis_text`        - mo ta tu do
 *
 * Quy tac chuyen doi:
 *   1. Moi phan tu cua `disease_groups` thanh mot `Diagnosis`, giu nguyen THU TU cu
 *      (`WITH ORDINALITY`); phan tu dau tien la `is_primary`.
 *   2. Neu `disease_groups` rong nhung co `diagnosis_text` thi tao MOT chan doan tu
 *      chinh chuoi do, `is_primary = true`.
 *   3. Ten nhom benh duoc doi chieu voi bang `diseases` de dien `disease_id` khi khop -
 *      bao cao P10 gom nhom theo khoa ngoai thay vi so chuoi.
 *
 * `severity` mac dinh MILD: du lieu cu khong he ghi muc do, va doan bua mot muc do
 * cho ho so benh an la viec khong duoc phep lam.
 *
 * Cot `examinations.disease_groups` KHONG bi xoa (xem P4-T8): giu lam du lieu lich su,
 * chi ngung ghi moi.
 */
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
    // Dung MOT chan doan chinh cho moi ho so - rang buoc o tang CSDL chu khong chi o
    // tang ung dung, vi bao cao P10 se dua vao no.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_diagnoses_one_primary"
      ON "diagnoses" ("medical_record_id")
      WHERE "is_primary" AND "deleted_at" IS NULL
    `);

    // -- 1 + 3. Tung phan tu cua disease_groups -----------------------------------------
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

    // -- 2. Khong co nhom benh nhung co mo ta tu do -------------------------------------
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

    // `diagnosis_text` cua phieu kham co ca nhom benh LAN mo ta: mo ta di vao `notes`
    // cua chan doan chinh de khong mat chu nao.
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
