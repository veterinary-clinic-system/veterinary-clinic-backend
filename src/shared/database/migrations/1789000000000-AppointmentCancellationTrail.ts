import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Luu vet ket thuc bat thuong cua lich hen - SRS FR-05-04 doi ghi lai NGUOI HUY,
 * THOI DIEM va LY DO.
 *
 * Truoc day `cancel()` chi doi `status = CANCELLED`: sau mot tuan khong ai con biet
 * khach tu huy hay le tan huy ho, va vi sao. Bao cao huy/no-show cua P10 se doc dung
 * ba cot nay.
 *
 * MOT bo cot dung cho CA HAI ket cuc bat thuong (CANCELLED va NO_SHOW): ve nghiep vu
 * chung deu tra loi "vi sao lan kham nay khong dien ra". `status` da phan biet duoc
 * hai truong hop nen khong can nhan doi cot.
 *
 * Du lieu cu: cac lich da CANCELLED truoc migration nay khong the truy nguoc ai huy -
 * de NULL va giao dien hien "khong ro". Bia mot nguoi huy con te hon la de trong.
 */
export class AppointmentCancellationTrail1789000000000 implements MigrationInterface {
  name = 'AppointmentCancellationTrail1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
        ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" uuid,
        ADD COLUMN IF NOT EXISTS "cancelled_at"         timestamptz,
        ADD COLUMN IF NOT EXISTS "cancel_reason"        text
    `);

    // ON DELETE SET NULL giong `booked_by_user_id`: xoa tai khoan nhan vien khong duoc
    // keo theo lich hen.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "appointments"
          ADD CONSTRAINT "fk_appointments_cancelled_by_user"
          FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // Bao cao P10 loc theo (trang thai ket thuc, thoi diem huy).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appointments_cancelled_at"
      ON "appointments" ("cancelled_at") WHERE "cancelled_at" IS NOT NULL
    `);

    // Ban sao ly do tren chinh luot cho: man hinh hang cho hien duoc ma khong phai JOIN
    // sang lich hen, va luot cho cua khach vang lai chua chac da co lich hen de JOIN.
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
