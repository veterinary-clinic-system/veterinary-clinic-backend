import { MigrationInterface, QueryRunner } from 'typeorm';

export class RequiredEntityImages1799000000000 implements MigrationInterface {
  name = 'RequiredEntityImages1799000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" varchar NOT NULL DEFAULT '/images/default-user.svg'`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "avatar_url" varchar NOT NULL DEFAULT '/images/default-staff.svg'`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "image_url" varchar NOT NULL DEFAULT '/images/default-item.svg'`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "avatar_url" = '/images/default-user.svg' WHERE "avatar_url" IS NULL OR BTRIM("avatar_url") = ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "avatar_url" SET DEFAULT '/images/default-user.svg'`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "avatar_url" SET NOT NULL`);
    await queryRunner.query(
      `UPDATE "employees" SET "avatar_url" = '/images/default-staff.svg' WHERE "avatar_url" IS NULL OR BTRIM("avatar_url") = ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" ALTER COLUMN "avatar_url" SET DEFAULT '/images/default-staff.svg'`,
    );
    await queryRunner.query(`ALTER TABLE "employees" ALTER COLUMN "avatar_url" SET NOT NULL`);
    await queryRunner.query(
      `UPDATE "items" SET "image_url" = '/images/default-item.svg' WHERE "image_url" IS NULL OR BTRIM("image_url") = ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ALTER COLUMN "image_url" SET DEFAULT '/images/default-item.svg'`,
    );
    await queryRunner.query(`ALTER TABLE "items" ALTER COLUMN "image_url" SET NOT NULL`);
    await queryRunner.query(
      `UPDATE "doctors" SET "avatar_url" = '/images/default-doctor.svg' WHERE "avatar_url" IS NULL OR BTRIM("avatar_url") = ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" ALTER COLUMN "avatar_url" SET DEFAULT '/images/default-doctor.svg'`,
    );
    await queryRunner.query(`ALTER TABLE "doctors" ALTER COLUMN "avatar_url" SET NOT NULL`);
    await queryRunner.query(
      `UPDATE "pets" SET "avatar_url" = '/images/default-pet.svg' WHERE "avatar_url" IS NULL OR BTRIM("avatar_url") = ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "pets" ALTER COLUMN "avatar_url" SET DEFAULT '/images/default-pet.svg'`,
    );
    await queryRunner.query(`ALTER TABLE "pets" ALTER COLUMN "avatar_url" SET NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pets" ALTER COLUMN "avatar_url" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "pets" ALTER COLUMN "avatar_url" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "doctors" ALTER COLUMN "avatar_url" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "doctors" ALTER COLUMN "avatar_url" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN IF EXISTS "image_url"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN IF EXISTS "avatar_url"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar_url"`);
  }
}
