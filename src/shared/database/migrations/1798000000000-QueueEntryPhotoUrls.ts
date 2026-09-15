import { MigrationInterface, QueryRunner } from 'typeorm';

export class QueueEntryPhotoUrls1798000000000 implements MigrationInterface {
  name = 'QueueEntryPhotoUrls1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "queue_entries"
        ADD COLUMN IF NOT EXISTS "photo_urls" text[] NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "queue_entries" DROP COLUMN IF EXISTS "photo_urls"`);
  }
}
