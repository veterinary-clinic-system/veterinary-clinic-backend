import { MigrationInterface, QueryRunner } from 'typeorm';

export class ItemCodeAndCategory1791000002000 implements MigrationInterface {
  name = 'ItemCodeAndCategory1791000002000';

  private static readonly PREFIXES: Array<[itemType: string, prefix: string]> = [
    ['SERVICE', 'DV'],
    ['MEDICATION', 'TH'],
    ['LAB_TEST', 'XN'],
    ['PRODUCT', 'SP'],
    ['OTHER', 'HH'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "code" varchar(32)`);
    await queryRunner.query(`
      ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "category_id" uuid
        REFERENCES "categories"("id") ON DELETE SET NULL
    `);

    for (const [itemType, prefix] of ItemCodeAndCategory1791000002000.PREFIXES) {
      const sequence = `item_code_${prefix.toLowerCase()}_seq`;
      await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "${sequence}" START 1`);

      await queryRunner.query(`
        UPDATE "items" i
           SET "code" = '${prefix}' || LPAD(s."seq"::text, 4, '0')
          FROM (
            SELECT "id", nextval('${sequence}') AS "seq"
              FROM (
                SELECT "id" FROM "items"
                 WHERE "itemType"::text = '${itemType}' AND "code" IS NULL
                 ORDER BY "created_at", "id"
              ) ordered
          ) s
         WHERE i."id" = s."id"
      `);
    }

    const cases = ItemCodeAndCategory1791000002000.PREFIXES.map(
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
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assign_item_code" ON "items"`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_assign_item_code"
      BEFORE INSERT ON "items"
      FOR EACH ROW EXECUTE FUNCTION "assign_item_code"()
    `);

    await queryRunner.query(`ALTER TABLE "items" ALTER COLUMN "code" SET NOT NULL`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_items_code"
      ON "items" ("code") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_items_category" ON "items" ("category_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assign_item_code" ON "items"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "assign_item_code"()`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_items_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_items_code"`);
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN IF EXISTS "category_id"`);
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN IF EXISTS "code"`);
    for (const [, prefix] of ItemCodeAndCategory1791000002000.PREFIXES) {
      await queryRunner.query(`DROP SEQUENCE IF EXISTS "item_code_${prefix.toLowerCase()}_seq"`);
    }
  }
}
