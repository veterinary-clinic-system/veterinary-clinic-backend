import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductItemType1791000001000 implements MigrationInterface {
  name = 'AddProductItemType1791000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."items_itemtype_enum" ADD VALUE IF NOT EXISTS 'PRODUCT'`,
    );
  }

  public async down(): Promise<void> {
    
  }
}
