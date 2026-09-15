import { MigrationInterface, QueryRunner } from 'typeorm';

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
