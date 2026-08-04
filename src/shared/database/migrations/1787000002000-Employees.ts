import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ho so nhan su - SRS FR-22.
 *
 * `employee_code` sinh tu sequence o tang CSDL chu khong o tang ung dung: hai quan tri
 * vien tao nhan vien cung luc se cung doc ra MAX(code) giong nhau va sinh trung ma.
 * Sequence la thu duy nhat dam bao duoc tinh duy nhat ma khong can khoa.
 *
 * Backfill: moi tai khoan nhan vien dang co (`users.role` khong phai PET_OWNER) duoc
 * tao san mot ho so nhan su tuong ung, trang thai ACTIVE. Neu khong lam buoc nay thi
 * man hinh Nhan su se rong tron trong khi he thong ro rang dang co nhan vien.
 */
export class Employees1787000002000 implements MigrationInterface {
  name = 'Employees1787000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "employees_status_enum" AS ENUM
          ('PROBATION', 'ACTIVE', 'SUSPENDED', 'RESIGNED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "employee_code_seq" START 1`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employees" (
        "id"            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        "deleted_at"    timestamptz,
        "employee_code" varchar(32) NOT NULL
                        DEFAULT 'NV' || LPAD(nextval('employee_code_seq')::text, 5, '0'),
        "user_id"       uuid REFERENCES "users"("id")    ON DELETE SET NULL,
        "full_name"     varchar(255) NOT NULL,
        "phone"         varchar(20)  NOT NULL,
        "email"         varchar(255),
        "address"       text,
        "position"      varchar(128),
        "branch_id"     uuid REFERENCES "branches"("id") ON DELETE RESTRICT,
        "hire_date"     date,
        "resigned_date" date,
        "status"        "employees_status_enum" NOT NULL DEFAULT 'PROBATION',
        "note"          text
      )
    `);

    // Partial unique: ho so da xoa mem khong giu cho ma nhan vien nua.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_employees_employee_code"
      ON "employees" ("employee_code") WHERE "deleted_at" IS NULL
    `);
    // Mot tai khoan dang nhap chi gan duoc voi dung mot ho so nhan su.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_employees_user_id"
      ON "employees" ("user_id") WHERE "deleted_at" IS NULL AND "user_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_employees_branch_status"
      ON "employees" ("branch_id", "status")
    `);

    await queryRunner.query(`
      INSERT INTO "employees"
        ("user_id", "full_name", "phone", "email", "branch_id", "status", "hire_date")
      SELECT u."id", u."full_name", u."phone", u."email", u."branch_id"::uuid,
             CASE WHEN u."active" THEN 'ACTIVE'::"employees_status_enum"
                  ELSE 'SUSPENDED'::"employees_status_enum" END,
             u."created_at"::date
        FROM "users" u
       WHERE u."role" <> 'PET_OWNER'
         AND u."deleted_at" IS NULL
         AND NOT EXISTS (SELECT 1 FROM "employees" e WHERE e."user_id" = u."id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "employees"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "employee_code_seq"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "employees_status_enum"`);
  }
}
