import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ma dinh danh nghiep vu cua khach hang va thu cung - SRS FR-03-01 / FR-04-01.
 *
 * UUID khong doc len duoc tai quay ("cho toi xem ho so 8f3c...`"), nen moi khach co
 * `KH000123` va moi thu cung co `TC000456`.
 *
 * Sinh o tang CSDL bang sequence chu khong o tang ung dung: hai le tan bam "Them khach
 * hang" cung luc se cung doc ra MAX(code) giong nhau va sinh trung ma. Day la cung co
 * che `employee_code` dang dung (xem 1787000002000-Employees.ts).
 *
 * Hai cach gan khac nhau, co ly do:
 *   - `pets.pet_code`: cot DEFAULT. Moi dong trong bang deu la mot thu cung nen luon
 *     phai co ma -> NOT NULL + DEFAULT la du.
 *   - `users.customer_code`: TRIGGER. Bang `users` chua ca tai khoan nhan vien; mot
 *     cot DEFAULT se cap ma "KH" cho ca bac si/le tan va lam thung so dem. Trigger chi
 *     cap ma khi `role = 'PET_OWNER'`.
 *
 * Backfill chay TRUOC khi dat DEFAULT de ma duoc cap theo dung thu tu `created_at`
 * (neu de ADD COLUMN ... DEFAULT nextval() tu dien, Postgres duyet theo thu tu vat ly
 * cua bang, ho so cu co the nhan ma lon hon ho so moi).
 */
export class CustomerAndPetCodes1788000000000 implements MigrationInterface {
  name = 'CustomerAndPetCodes1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------------
    // Khach hang
    // -------------------------------------------------------------------------------
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "customer_code_seq" START 1`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_code" varchar(32)`,
    );

    // `nextval` duoc goi tren tap da ORDER BY nen so tang dan theo ngay tao ho so.
    // Ke ca ho so da xoa mem cung duoc cap ma - lich su giao dich cu van hien thi duoc.
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

    // Partial unique: ho so da xoa mem khong giu cho ma nua (cung quy uoc voi
    // `uq_employees_employee_code`). Tai khoan nhan vien co `customer_code` NULL -
    // NULL khong tham gia rang buoc unique.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_customer_code"
      ON "users" ("customer_code") WHERE "deleted_at" IS NULL AND "customer_code" IS NOT NULL
    `);

    // -------------------------------------------------------------------------------
    // Thu cung
    // -------------------------------------------------------------------------------
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
