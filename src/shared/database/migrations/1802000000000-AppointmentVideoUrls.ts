import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentVideoUrls1802000000000 implements MigrationInterface {
  name = 'AppointmentVideoUrls1802000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
        ADD COLUMN IF NOT EXISTS "video_urls" text[] NOT NULL DEFAULT '{}'
    `);
    await queryRunner.query(`
      ALTER TABLE "queue_entries"
        ADD COLUMN IF NOT EXISTS "video_urls" text[] NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "queue_entries" DROP COLUMN IF EXISTS "video_urls"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN IF EXISTS "video_urls"`);
  }
}
