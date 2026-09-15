import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerAndPetCodes1788000000000 implements MigrationInterface {
  name = 'CustomerAndPetCodes1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "customer_code_seq" START 1`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_code" varchar(32)`,
    );

    await queryRunner.query(`
      UPDATE "users" u
         SET "customer_code" = 'KH' || LPAD(s."seq"::text, 6, '0')
        FROM (
          SELECT "id", nextval('customer_code_seq') AS "seq"
            FROM (
              SELECT "id" FROM "users"
               WHERE "role" = 'PET_OWNER' AND "customer_code" IS NULL
               ORDER BY "created_at", "id"
            ) ordered
        ) s
       WHERE u."id" = s."id"
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "assign_customer_code"() RETURNS trigger AS $$
      BEGIN
        IF NEW."customer_code" IS NULL AND NEW."role" = 'PET_OWNER' THEN
          NEW."customer_code" := 'KH' || LPAD(nextval('customer_code_seq')::text, 6, '0');
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assign_customer_code" ON "users"`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_assign_customer_code"
      BEFORE INSERT OR UPDATE OF "role" ON "users"
      FOR EACH ROW EXECUTE FUNCTION "assign_customer_code"()
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_customer_code"
      ON "users" ("customer_code") WHERE "deleted_at" IS NULL AND "customer_code" IS NOT NULL
    `);

    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "pet_code_seq" START 1`);
    await queryRunner.query(`ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "pet_code" varchar(32)`);

    await queryRunner.query(`
      UPDATE "pets" p
         SET "pet_code" = 'TC' || LPAD(s."seq"::text, 6, '0')
        FROM (
          SELECT "id", nextval('pet_code_seq') AS "seq"
            FROM (
              SELECT "id" FROM "pets" WHERE "pet_code" IS NULL ORDER BY "created_at", "id"
            ) ordered
        ) s
       WHERE p."id" = s."id"
    `);

    await queryRunner.query(`
      ALTER TABLE "pets"
        ALTER COLUMN "pet_code" SET DEFAULT 'TC' || LPAD(nextval('pet_code_seq')::text, 6, '0')
    `);
    await queryRunner.query(`ALTER TABLE "pets" ALTER COLUMN "pet_code" SET NOT NULL`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_pets_pet_code"
      ON "pets" ("pet_code") WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_pets_pet_code"`);
    await queryRunner.query(`ALTER TABLE "pets" DROP COLUMN IF EXISTS "pet_code"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "pet_code_seq"`);

    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assign_customer_code" ON "users"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "assign_customer_code"()`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_customer_code"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "customer_code"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "customer_code_seq"`);
  }
}
