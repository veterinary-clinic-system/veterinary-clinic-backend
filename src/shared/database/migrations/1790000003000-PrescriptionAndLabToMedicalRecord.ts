import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chuyen khoa ngoai cua `prescriptions` va `lab_test_orders`:
 * `examination_id` -> `medical_record_id` (P4-T6).
 *
 * LY DO: theo SRS, Prescription va Laboratory la hai khoi CUA HO SO BENH AN, khong
 * phai cua rieng phan sinh hieu. Treo chung duoi `examinations` la di san tu thoi
 * chua co `MedicalRecord` - hau qua thuc te: mot ho so chua kip ghi sinh hieu thi
 * khong ke don duoc, vi chua co hang `examinations` nao de tro toi.
 *
 * BON BUOC TRONG MOT MIGRATION - co y: giua buoc them cot va buoc xoa cot cu, luoc do
 * o trang thai nua voi (hai khoa ngoai song song, khong cai nao la su that). Tach ra
 * hai file nghia la co mot khoang thoi gian ma ung dung chay tren luoc do do.
 *
 *   1. Them cot `medical_record_id`
 *   2. Backfill qua `examinations.medical_record_id`
 *   3. Dat NOT NULL + khoa ngoai + chi muc
 *   4. Xoa cot `examination_id`
 *
 * BUOC 0 - VA DE CAN THAN: migration `MedicalRecords1790000000000` chi sinh ho so cho
 * cac phieu kham CHUA XOA MEM (`deleted_at IS NULL`). Don thuoc cua mot phieu kham da
 * xoa mem van con nguyen trong bang, va se rot lai NULL o buoc 2 roi lam vo buoc 3.
 * Nen o day sinh not ho so cho nhung phieu kham do - ban than ho so cung duoc danh
 * dau xoa mem theo, de chung khong hien ra trong benh su.
 */
export class PrescriptionAndLabToMedicalRecord1790000003000 implements MigrationInterface {
  name = 'PrescriptionAndLabToMedicalRecord1790000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -- 0. Vet not cac phieu kham da xoa mem ------------------------------------------
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
      // -- 1. Them cot ------------------------------------------------------------------
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "medical_record_id" uuid`,
      );

      // -- 2. Backfill ------------------------------------------------------------------
      await queryRunner.query(`
        UPDATE "${table}" t
           SET "medical_record_id" = e."medical_record_id"
          FROM "examinations" e
         WHERE e."id" = t."examination_id"
           AND t."medical_record_id" IS NULL
      `);

      // Chan chay tiep khi con hang mo coi: den day ma con NULL nghia la co don
      // thuoc/chi dinh tro toi mot phieu kham khong ton tai. Thua ra loi ro rang o
      // migration con hon de `SET NOT NULL` nem mot loi khong noi duoc gi.
      const orphans: Array<{ count: number }> = await queryRunner.query(
        `SELECT count(*)::int AS "count" FROM "${table}" WHERE "medical_record_id" IS NULL`,
      );
      if (orphans[0].count > 0) {
        throw new Error(
          `${table}: ${orphans[0].count} hàng không tìm được hồ sơ bệnh án tương ứng ` +
            `(examination_id trỏ tới phiếu khám không tồn tại). Dừng migration để không mất dữ liệu.`,
        );
      }

      // -- 3. NOT NULL + khoa ngoai + chi muc -------------------------------------------
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

      // -- 4. Xoa cot cu ----------------------------------------------------------------
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "examination_id"`);
    }
  }

  /**
   * Duong lui khoi phuc `examination_id` tu `medical_record_id` qua
   * `examinations.medical_record_id` - lam duoc vi quan he ho so <-> phieu kham la 1:1
   * va chi muc `uq_examinations_medical_record` bao dam dieu do.
   */
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
      // Hang thuoc mot ho so CHUA co phieu sinh hieu khong bieu dien duoc o luoc do cu
      // (khong co `examination_id` nao de tro toi) nen buoc phai xoa han. Day la mat
      // mat KHONG hoi phuc duoc cua duong lui - chi nhung don thuoc/chi dinh duoc tao
      // SAU migration nay, tren mot ho so chua ghi sinh hieu, moi roi vao dien do.
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
