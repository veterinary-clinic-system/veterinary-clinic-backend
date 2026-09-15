import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type Redis from 'ioredis';
import { RolePermission } from '@/modules/identity/domain/entities/role-permission.entity';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  Permission,
} from '@/shared/common/enums/permission.enum';
import { Role, STAFF_ROLES } from '@/shared/common/enums/role.enum';
import { REDIS_CLIENT } from '@/shared/redis/redis.constants';

const CACHE_TTL_SECONDS = 60;

export interface RolePermissionMatrixRow {
  role: Role;
  permissions: Permission[];
}

export interface PermissionCatalogEntry {
  group: string;
  permissions: Permission[];
}

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(RolePermission)
    private readonly rolePermissionsRepository: Repository<RolePermission>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getPermissionsForRole(role: Role): Promise<Set<Permission>> {
    const cacheKey = this.cacheKey(role);

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      return new Set(JSON.parse(cached) as Permission[]);
    }

    const rows = await this.rolePermissionsRepository.find({ where: { role } });
    const permissions = rows.map((row) => row.permission);

    await this.redis
      .set(cacheKey, JSON.stringify(permissions), 'EX', CACHE_TTL_SECONDS)
      .catch(() => undefined);

    return new Set(permissions);
  }

  async getMatrix(): Promise<RolePermissionMatrixRow[]> {
    const rows = await this.rolePermissionsRepository.find();
    return STAFF_ROLES.map((role) => ({
      role,
      permissions: rows.filter((row) => row.role === role).map((row) => row.permission),
    }));
  }

  getCatalog(): PermissionCatalogEntry[] {
    return Object.entries(PERMISSION_GROUPS).map(([group, permissions]) => ({
      group,
      permissions,
    }));
  }

  async setRolePermissions(role: Role, permissions: Permission[]): Promise<Permission[]> {
    if (role === Role.ADMIN) {
      throw new BadRequestException(
        'Không thể thay đổi quyền của Quản trị viên — vai trò này luôn có toàn quyền.',
      );
    }
    if (!STAFF_ROLES.includes(role)) {
      throw new BadRequestException('Chỉ có thể phân quyền cho các vai trò nhân viên.');
    }

    const unique = [...new Set(permissions)];

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RolePermission, { role });
      if (unique.length > 0) {
        await manager.insert(
          RolePermission,
          unique.map((permission) => ({ role, permission })),
        );
      }
    });

    await this.redis.del(this.cacheKey(role)).catch(() => undefined);
    return unique;
  }

  async resetRoleToDefault(role: Role): Promise<Permission[]> {
    return this.setRolePermissions(role, DEFAULT_ROLE_PERMISSIONS[role] ?? []);
  }

  private cacheKey(role: Role): string {
    return `permissions:role:${role}`;
  }
}
