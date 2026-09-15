import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogSearchIndexes1791000005000 implements MigrationInterface {
  name = 'CatalogSearchIndexes1791000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_items_item_name_trgm"
      ON "items" USING GIN (f_unaccent("item_name") gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_items_code_trgm"
      ON "items" USING GIN ("code" gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_products_sku_trgm"
      ON "products" USING GIN ("sku" gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_suppliers_name_trgm"
      ON "suppliers" USING GIN (f_unaccent("name") gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_suppliers_code_trgm"
      ON "suppliers" USING GIN ("supplier_code" gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_suppliers_code_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_suppliers_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_sku_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_items_code_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_items_item_name_trgm"`);
  }
}
