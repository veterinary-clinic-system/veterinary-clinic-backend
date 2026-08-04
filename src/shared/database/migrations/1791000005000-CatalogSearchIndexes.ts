import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chi muc phuc vu tim kiem danh muc - NFR-02 ("tim kiem duoi 500ms voi 5.000 san pham").
 *
 * Man hinh san pham tim bang `ILIKE '%tu khoa%'`. Mot chi muc B-tree KHONG dung duoc
 * cho dang do (tien to `%` lam hong thu tu sap xep) nen Postgres se quet toan bang.
 * GIN trigram thi dung duoc - cung cach da lam cho `users.full_name` va `pets.name`
 * trong `1785000000000-ArchitectureDocPartV.ts`.
 *
 * Ten hang di qua `f_unaccent` (ham IMMUTABLE dinh nghia o migration do) de go khong
 * dau van ra ket qua: "thuc an" tim duoc "Thức ăn". Bieu thuc trong chi muc phai TRUNG
 * KHIT bieu thuc trong menh de WHERE, neu khong chi muc se bi bo qua - xem
 * `ProductsService.findAll`.
 *
 * `sku`, `items.code` va `suppliers.supplier_code` khong boc `f_unaccent`: chung la ma
 * ASCII, khong dau, nen boc vao chi ton them mot lan goi ham moi hang.
 */
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
