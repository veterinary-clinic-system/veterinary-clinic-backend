import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phuong phap dieu tri - SRS FR-10.
 *
 * KHONG co du lieu cu de backfill: khai niem "dieu tri" truoc P4 khong ton tai o dau
 * trong luoc do (don thuoc khong thay the duoc - truyen dich, tiem, phau thuat deu la
 * dieu tri ma khong phai thuoc).
 *
 * `chk_treatments_date_order` lap lai o tang CSDL luat ma DTO da kiem. Ly do khong
 * chi tin vao DTO: cac duong ghi khac (script nhap lieu, migration ve sau, sua tay
 * qua psql) khong di qua ValidationPipe, va mot khoang dieu tri ket thuc truoc khi
 * bat dau la du lieu vo nghia trong ho so y te.
 */
export class Treatments1790000002000 implements MigrationInterface {
  name = 'Treatments1790000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "treatments" (
        "id"                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        "deleted_at"        timestamptz,
        "medical_record_id" uuid NOT NULL REFERENCES "medical_records"("id") ON DELETE CASCADE,
        "method"            varchar(255) NOT NULL,
        "description"       text,
        "start_date"        date NOT NULL,
        "end_date"          date,
        "instruction"       text,
        "notes"             text,
        CONSTRAINT "chk_treatments_date_order"
          CHECK ("end_date" IS NULL OR "end_date" >= "start_date")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_treatments_medical_record"
      ON "treatments" ("medical_record_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "treatments"`);
  }
}
