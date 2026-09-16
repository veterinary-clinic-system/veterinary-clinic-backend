import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DEFAULT_DOCTOR_IMAGE,
  DEFAULT_ITEM_IMAGE,
  DEFAULT_PET_IMAGE,
  DEFAULT_STAFF_IMAGE,
  DEFAULT_USER_IMAGE,
  CLOUDINARY_CLOUD_NAME,
  cloudinaryWebImage,
} from '@/shared/storage/cloudinary-web-assets';

export class CloudinaryAssetUrls1801000000000 implements MigrationInterface {
  name = 'CloudinaryAssetUrls1801000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!CLOUDINARY_CLOUD_NAME) {
      throw new Error('CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME is required before migrating image URLs');
    }

    await this.replace(queryRunner, 'users', 'avatar_url', DEFAULT_USER_IMAGE, [
      '/images/default-user.svg',
    ]);
    await this.replace(queryRunner, 'employees', 'avatar_url', DEFAULT_STAFF_IMAGE, [
      '/images/default-staff.svg',
    ]);
    await this.replace(queryRunner, 'items', 'image_url', DEFAULT_ITEM_IMAGE, [
      '/images/default-item.svg',
    ]);
    await this.replace(queryRunner, 'pets', 'avatar_url', DEFAULT_PET_IMAGE, [
      '/images/default-pet.svg',
    ]);
    await this.replace(queryRunner, 'doctors', 'avatar_url', DEFAULT_DOCTOR_IMAGE, [
      '/images/default-doctor.svg',
    ]);

    for (let index = 1; index <= 6; index += 1) {
      await queryRunner.query(
        `UPDATE "doctors" SET "avatar_url" = $1 WHERE "avatar_url" = $2`,
        [cloudinaryWebImage(`doctors/doctor-${index}.svg`), `/doctors/doctor-${index}.svg`],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.replace(queryRunner, 'users', 'avatar_url', '/images/default-user.svg', [
      DEFAULT_USER_IMAGE,
    ]);
    await this.replace(queryRunner, 'employees', 'avatar_url', '/images/default-staff.svg', [
      DEFAULT_STAFF_IMAGE,
    ]);
    await this.replace(queryRunner, 'items', 'image_url', '/images/default-item.svg', [
      DEFAULT_ITEM_IMAGE,
    ]);
    await this.replace(queryRunner, 'pets', 'avatar_url', '/images/default-pet.svg', [
      DEFAULT_PET_IMAGE,
    ]);
    await this.replace(queryRunner, 'doctors', 'avatar_url', '/images/default-doctor.svg', [
      DEFAULT_DOCTOR_IMAGE,
    ]);
  }

  private async replace(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    nextDefault: string,
    oldValues: string[],
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" = ANY($2::varchar[])`,
      [nextDefault, oldValues],
    );
    await queryRunner.query(
      `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT '${nextDefault.replace(/'/g, "''")}'`,
    );
  }
}
