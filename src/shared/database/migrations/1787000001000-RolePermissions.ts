import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_ROLE_PERMISSIONS, Permission } from '@/shared/common/enums/permission.enum';

export class RolePermissions1787000001000 implements MigrationInterface {
  name = 'RolePermissions1787000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const roleValues = Object.keys(DEFAULT_ROLE_PERMISSIONS)
      .concat('PET_OWNER')
      .map((r) => `'${r}'`)
      .join(', ');
    const permissionValues = Object.values(Permission)
      .map((p) => `'${p}'`)
      .join(', ');

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "role_permissions_role_enum" AS ENUM (${roleValues});
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "role_permissions_permission_enum" AS ENUM (${permissionValues});
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "id"         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "role"       "role_permissions_role_enum"       NOT NULL,
        "permission" "role_permissions_permission_enum" NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_role_permissions_role_permission"
      ON "role_permissions" ("role", "permission")
    `);

    const rows: string[] = [];
    for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        rows.push(`('${role}', '${permission}')`);
      }
    }
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role", "permission")
      VALUES ${rows.join(', ')}
      ON CONFLICT ("role", "permission") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "role_permissions_permission_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "role_permissions_role_enum"`);
  }
}
