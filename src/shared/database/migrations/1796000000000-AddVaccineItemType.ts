import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVaccineItemType1796000000000 implements MigrationInterface {
  name = 'AddVaccineItemType1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."items_itemtype_enum" ADD VALUE IF NOT EXISTS 'VACCINE'`,
    );
  }

  public async down(): Promise<void> {
    
  }
}
