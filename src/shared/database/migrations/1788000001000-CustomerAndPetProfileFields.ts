import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cac truong ho so con thieu so voi SRS FR-03-01 / FR-04-01.
 *
 * `users.date_of_birth`: ngay sinh khach hang.
 * `pets.microchip_id`  : so microchip. NFR-02 liet ke dich danh truong nay la truong
 *                        can index -> lam luon UNIQUE (partial) thay vi index thuong:
 *                        vua thoa NFR-02 vua chan hai ho so cung mot con chip.
 * `pets.color`         : mau long.
 *
 * `microchip_id` de trong duoc (thu cung chua gan chip) va NHIEU dong trong khong
 * xung dot voi nhau - trong Postgres, NULL khong tham gia rang buoc unique. Dieu kien
 * `deleted_at IS NULL` giu dung quy uoc xoa mem cua codebase: ho so da xoa mem khong
 * giu cho so chip nua.
 */
export class CustomerAndPetProfileFields1788000001000 implements MigrationInterface {
  name = 'CustomerAndPetProfileFields1788000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "date_of_birth" date`);

    await queryRunner.query(
      `ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "microchip_id" varchar(64)`,
    );
    await queryRunner.query(`ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "color" varchar(64)`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_pets_microchip_id"
      ON "pets" ("microchip_id") WHERE "deleted_at" IS NULL AND "microchip_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_pets_microchip_id"`);
    await queryRunner.query(`ALTER TABLE "pets" DROP COLUMN IF EXISTS "color"`);
    await queryRunner.query(`ALTER TABLE "pets" DROP COLUMN IF EXISTS "microchip_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "date_of_birth"`);
  }
}
