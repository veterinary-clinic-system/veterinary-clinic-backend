import { MigrationInterface, QueryRunner } from 'typeorm';

export class VaccinationInventoryReference1796000003000 implements MigrationInterface {
  name = 'VaccinationInventoryReference1796000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."inventory_transactions_reference_type_enum"
        ADD VALUE IF NOT EXISTS 'VACCINATION'
    `);
  }

  public async down(): Promise<void> {
    
  }
}
