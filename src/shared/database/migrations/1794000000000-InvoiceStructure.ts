import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Noi long cau truc Invoice - P8-T1, SRS FR-20.
 *
 * DAY LA THAY DOI PHA VO DUY NHAT CUA CA KE HOACH 10 PHASE, nen no di mot minh trong
 * mot migration rieng. `invoices.appointment_id` dang la NOT NULL + UNIQUE; POS ban cho
 * khach vang lai khong co lich hen nao de gan vao.
 *
 * Luat nghiep vu "mot lich hen chi mot hoa don" KHONG bi noi long - no chuyen tu rang
 * buoc UNIQUE sang chi muc unique CO DIEU KIEN. Hai hoa don POS cung mang NULL khong va
 * nhau (Postgres khong coi hai NULL la trung), nhung viet dieu kien ra van tot hon dua
 * vao dac tinh do: y dinh doc duoc ngay tren dinh nghia chi muc.
 *
 * BACKFILL PHAI KHONG LECH MOT DONG NAO. Bon con so tien duoc chot cung tu chinh cac
 * dong hoa don dang co (`SUM(price x quantity)`), giam gia va thue = 0 - tuc la dung so
 * ma man hinh hoa don van dang tinh dong va hien ra hom nay. Sau migration nay, moi cho
 * doc tien phai doc `total_amount`, khong tinh lai tu `items` nua.
 *
 * `invoice_code` duoc cap theo THU TU THOI GIAN TAO (`ORDER BY created_at`) chu khong
 * de `ALTER TABLE ... ADD COLUMN DEFAULT nextval(...)` tu dien: thu tu rewrite cua
 * Postgres la thu tu vat ly cua bang, nen ma hoa don se nhay lung tung so voi ngay lap.
 */
export class InvoiceStructure1794000000000 implements MigrationInterface {
  name = 'InvoiceStructure1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------- 1. Noi rang buoc appointment_id

    // Ten rang buoc UNIQUE do TypeORM tu sinh (`REL_...`), khac nhau giua cac moi truong
    // - tra ten tu catalog thay vi go cung mot chuoi bam.
    await queryRunner.query(`
      DO $$
      DECLARE constraint_name text;
      BEGIN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'invoices'::regclass
          AND contype = 'u'
          AND conkey = ARRAY[
            (SELECT attnum FROM pg_attribute
             WHERE attrelid = 'invoices'::regclass AND attname = 'appointment_id')
          ];
        IF constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "invoices" DROP CONSTRAINT %I', constraint_name);
        END IF;
      END $$
    `);

    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "appointment_id" DROP NOT NULL`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoices_appointment"
      ON "invoices" ("appointment_id")
      WHERE "appointment_id" IS NOT NULL AND "deleted_at" IS NULL
    `);

    // -------------------------------------------------------------- 2. Cot moi

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "invoices_source_enum" AS ENUM ('CLINIC', 'POS');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD COLUMN IF NOT EXISTS "invoice_code"     varchar(32),
        ADD COLUMN IF NOT EXISTS "source"           "invoices_source_enum" NOT NULL DEFAULT 'CLINIC',
        ADD COLUMN IF NOT EXISTS "customer_id"      uuid REFERENCES "users"("id") ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS "branch_id"        uuid REFERENCES "branches"("id") ON DELETE RESTRICT,
        ADD COLUMN IF NOT EXISTS "subtotal"         bigint NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "discount_amount"  bigint NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "tax_amount"       bigint NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_amount"     bigint NOT NULL DEFAULT 0
    `);

    // ------------------------------------------------------------- 3. Backfill

    // Ma hoa don theo thu tu lap - xem comment dau lop.
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "invoice_code_seq" START 1`);
    await queryRunner.query(`
      UPDATE "invoices" AS i
      SET "invoice_code" = 'HD' || LPAD(numbered.seq::text, 6, '0')
      FROM (
        SELECT "id", nextval('invoice_code_seq') AS seq
        FROM (SELECT "id" FROM "invoices" ORDER BY "created_at", "id") AS ordered
      ) AS numbered
      WHERE i."id" = numbered."id"
    `);

    // Khach hang + chi nhanh cua hoa don kham: lay qua lich hen. Moi hoa don co truoc
    // P8 deu co lich hen, nen sau buoc nay khong con dong nao thieu `branch_id`.
    await queryRunner.query(`
      UPDATE "invoices" AS i
      SET "customer_id" = p."owner_id",
          "branch_id"   = a."branch_id"
      FROM "appointments" AS a
      JOIN "pets" AS p ON p."id" = a."pet_id"
      WHERE a."id" = i."appointment_id"
    `);

    // Chot cung so tien tu chinh cac dong dang co - dung so man hinh dang hien.
    await queryRunner.query(`
      UPDATE "invoices" AS i
      SET "subtotal"     = COALESCE(line.total, 0),
          "total_amount" = COALESCE(line.total, 0)
      FROM (
        SELECT "invoice_id", SUM("price" * "quantity") AS total
        FROM "invoice_items"
        WHERE "deleted_at" IS NULL
        GROUP BY "invoice_id"
      ) AS line
      WHERE line."invoice_id" = i."id"
    `);

    // ------------------------------------------------- 4. Chot cac rang buoc con lai

    await queryRunner.query(`
      ALTER TABLE "invoices"
        ALTER COLUMN "invoice_code" SET NOT NULL,
        ALTER COLUMN "invoice_code" SET DEFAULT 'HD' || LPAD(nextval('invoice_code_seq')::text, 6, '0'),
        ALTER COLUMN "branch_id" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoices_invoice_code"
      ON "invoices" ("invoice_code") WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD CONSTRAINT "chk_invoices_amounts_non_negative"
          CHECK ("subtotal" >= 0 AND "discount_amount" >= 0 AND "tax_amount" >= 0
                 AND "total_amount" >= 0),
        ADD CONSTRAINT "chk_invoices_discount_within_subtotal"
          CHECK ("discount_amount" <= "subtotal"),
        ADD CONSTRAINT "chk_invoices_total_consistent"
          CHECK ("total_amount" = "subtotal" - "discount_amount" + "tax_amount")
    `);

    // Hoa don POS luon phai co gio hang cua no; hoa don kham luon phai co lich hen.
    // Rang buoc nay la cai giu cho `source` khong bao gio noi doi ve nguon goc.
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD CONSTRAINT "chk_invoices_source_matches_appointment"
        CHECK (
          ("source" = 'CLINIC' AND "appointment_id" IS NOT NULL)
          OR ("source" = 'POS' AND "appointment_id" IS NULL)
        )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoices_customer_created"
      ON "invoices" ("customer_id", "created_at" DESC) WHERE "customer_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoices_source_created"
      ON "invoices" ("source", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoices_branch_created"
      ON "invoices" ("branch_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoices_branch_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoices_source_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoices_customer_created"`);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        DROP CONSTRAINT IF EXISTS "chk_invoices_source_matches_appointment",
        DROP CONSTRAINT IF EXISTS "chk_invoices_total_consistent",
        DROP CONSTRAINT IF EXISTS "chk_invoices_discount_within_subtotal",
        DROP CONSTRAINT IF EXISTS "chk_invoices_amounts_non_negative"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_invoices_invoice_code"`);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        DROP COLUMN IF EXISTS "total_amount",
        DROP COLUMN IF EXISTS "tax_amount",
        DROP COLUMN IF EXISTS "discount_amount",
        DROP COLUMN IF EXISTS "subtotal",
        DROP COLUMN IF EXISTS "branch_id",
        DROP COLUMN IF EXISTS "customer_id",
        DROP COLUMN IF EXISTS "source",
        DROP COLUMN IF EXISTS "invoice_code"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "invoices_source_enum"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "invoice_code_seq"`);

    // Quay ve NOT NULL + UNIQUE chi lam duoc khi chua co hoa don POS nao. Neu da co thi
    // du lieu do phai duoc xu ly bang tay truoc - mot migration khong duoc tu quyet dinh
    // xoa hoa don ban hang.
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_invoices_appointment"`);
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "appointment_id" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD CONSTRAINT "uq_invoices_appointment_id" UNIQUE ("appointment_id")
    `);
  }
}
