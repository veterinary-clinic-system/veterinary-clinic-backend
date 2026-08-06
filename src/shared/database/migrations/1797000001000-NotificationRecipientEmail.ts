import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hai cot cho kenh EMAIL tren nhat ky gui tin - P10-T6.
 *
 * `recipient_email` NULLABLE va khong co gia tri mac dinh: phan lon khach cua phong kham
 * chi de lai so dien thoai. Cac dong da co tu truoc cung de `NULL` - chung deu la tin
 * nhan SMS/Zalo, khong dong nao tung di qua kenh email nen khong co gi de dien vao.
 *
 * `attempt_count` mac dinh 0 va cac dong cu cung nhan 0 - tuc chung se duoc thu lai neu
 * dang o trang thai `FAILED`. Do la dieu MONG MUON: chinh nhung dong ay la bang chung
 * cua loi ma P10-T6 sua (mot lan gui hong truoc day la mat vinh vien).
 */
export class NotificationRecipientEmail1797000001000 implements MigrationInterface {
  name = 'NotificationRecipientEmail1797000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "recipient_email" varchar(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN IF NOT EXISTS "attempt_count" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "attempt_count"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "recipient_email"`);
  }
}
