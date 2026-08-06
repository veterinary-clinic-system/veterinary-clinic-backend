import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Danh muc vaccine - SRS FR-12, P9-T1.
 *
 * BA VIEC, va viec thu hai de bi bo quen nhat: `items.code` do trigger
 * `trg_assign_item_code` cap (xem `1791000002000-ItemCodeAndCategory.ts`), va ham do
 * lam viec bang mot CASE liet ke DU cac `itemType`. Them mot loai moi ma khong cap
 * nhat ham thi CASE tra NULL, va `items.code NOT NULL` se lam moi lenh tao vaccine that
 * bai - o tang CSDL, sau khi ung dung da build sach. Vi vay migration nay tao sequence
 * `item_code_vx_seq` va CREATE OR REPLACE lai ham voi day du sau tien to.
 *
 * `vaccine_species` la bang noi thay vi cot `uuid[]` tren `vaccines`: xem ghi chu o
 * `vaccine.entity.ts`. Khong co dong nao = vaccine dung cho moi loai.
 */
export class Vaccines1796000001000 implements MigrationInterface {
  name = 'Vaccines1796000001000';

  /** Phai khop `ItemType` - xem ghi chu dau lop. */
  private static readonly PREFIXES: Array<[itemType: string, prefix: string]> = [
    ['SERVICE', 'DV'],
    ['MEDICATION', 'TH'],
    ['LAB_TEST', 'XN'],
    ['PRODUCT', 'SP'],
    ['VACCINE', 'VX'],
    ['OTHER', 'HH'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "item_code_vx_seq" START 1`);

    const cases = Vaccines1796000001000.PREFIXES.map(
      ([itemType, prefix]) =>
        `WHEN '${itemType}' THEN '${prefix}' || LPAD(nextval('item_code_${prefix.toLowerCase()}_seq')::text, 4, '0')`,
    ).join('\n            ');

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "assign_item_code"() RETURNS trigger AS $$
      BEGIN
        IF NEW."code" IS NULL THEN
          NEW."code" := CASE NEW."itemType"::text
            ${cases}
          END;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vaccines" (
        "id"                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"             timestamptz NOT NULL DEFAULT now(),
        "updated_at"             timestamptz NOT NULL DEFAULT now(),
        "deleted_at"             timestamptz,
        "item_id"                uuid NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
        "disease_prevented"      varchar(255) NOT NULL,
        "dose_count"             integer NOT NULL DEFAULT 1,
        "interval_days"          integer,
        "booster_interval_days"  integer,
        "manufacturer"           varchar(255),
        "supplier_id"            uuid REFERENCES "suppliers"("id") ON DELETE SET NULL,
        "cost_price"             bigint NOT NULL DEFAULT 0,
        "minimum_stock"          integer NOT NULL DEFAULT 0,
        "active"                 boolean NOT NULL DEFAULT true,
        CONSTRAINT "chk_vaccines_dose_count_positive" CHECK ("dose_count" >= 1),
        CONSTRAINT "chk_vaccines_interval_positive"
          CHECK ("interval_days" IS NULL OR "interval_days" > 0),
        CONSTRAINT "chk_vaccines_booster_positive"
          CHECK ("booster_interval_days" IS NULL OR "booster_interval_days" > 0),
        CONSTRAINT "chk_vaccines_cost_price_non_negative" CHECK ("cost_price" >= 0),
        CONSTRAINT "chk_vaccines_minimum_stock_non_negative" CHECK ("minimum_stock" >= 0)
      )
    `);

    // Quan he 1:1 voi `items` - cung quy uoc voi `medications` / `products`.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_vaccines_item"
      ON "vaccines" ("item_id") WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vaccine_species" (
        "vaccine_id"  uuid NOT NULL REFERENCES "vaccines"("id") ON DELETE CASCADE,
        "species_id"  uuid NOT NULL REFERENCES "species"("id") ON DELETE CASCADE,
        PRIMARY KEY ("vaccine_id", "species_id")
      )
    `);
    // Loc "vaccine nao dung duoc cho loai nay" di theo chieu species -> vaccine.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_vaccine_species_species"
      ON "vaccine_species" ("species_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vaccine_species"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vaccines"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "item_code_vx_seq"`);

    // Tra ham cap ma ve danh sach truoc P9. Khong bo qua buoc nay: de nguyen ham co
    // nhac 'VACCINE' thi `nextval('item_code_vx_seq')` se tro toi mot sequence vua bi
    // xoa, va moi lenh tao item se hong theo.
    const cases = Vaccines1796000001000.PREFIXES.filter(([itemType]) => itemType !== 'VACCINE')
      .map(
        ([itemType, prefix]) =>
          `WHEN '${itemType}' THEN '${prefix}' || LPAD(nextval('item_code_${prefix.toLowerCase()}_seq')::text, 4, '0')`,
      )
      .join('\n            ');

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "assign_item_code"() RETURNS trigger AS $$
      BEGIN
        IF NEW."code" IS NULL THEN
          NEW."code" := CASE NEW."itemType"::text
            ${cases}
          END;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
  }
}
