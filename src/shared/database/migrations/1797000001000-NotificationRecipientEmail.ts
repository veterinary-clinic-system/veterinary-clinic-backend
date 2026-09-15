import { MigrationInterface, QueryRunner } from 'typeorm';

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
