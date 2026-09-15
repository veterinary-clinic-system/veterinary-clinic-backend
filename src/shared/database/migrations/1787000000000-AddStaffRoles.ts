import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffRoles1787000000000 implements MigrationInterface {
  name = 'AddStaffRoles1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const role of ['MANAGER', 'PHARMACIST', 'STAFF']) {
      await queryRunner.query(
        `ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS '${role}'`,
      );
    }
  }

  public async down(): Promise<void> {
    
  }
}
