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

/**
 * TTL ngan co chu dich. Doi mot dong phan quyen la viec hiem (vai lan mot nam), nen
 * cache lau khong dang de danh doi voi rui ro "da go quyen roi ma nguoi do van thao
 * tac duoc". 60 giay la muc chap nhan duoc, va `setRolePermissions` con chu dong xoa
 * cache nen truong hop thuong gap la co hieu luc NGAY.
 *
 * Vi sao van can TTL du da chu dong xoa: he thong co the chay nhieu tien trinh API,
 * nhung Redis la dung chung nen viec xoa co hieu luc voi tat ca. TTL o day la luoi an
 * toan cho truong hop Redis bi khoi dong lai giua chung hoac lenh xoa that bai.
 */
const CACHE_TTL_SECONDS = 60;

/** Mot dong cua ma tran phan quyen, phuc vu man hinh quan tri. */
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

  /**
   * Tap quyen cua mot vai tro. Duoc goi tren MOI request co `@RequirePermissions`,
   * nen bat buoc phai qua cache - neu khong, moi request se them mot truy van CSDL.
   *
   * Redis chet thi rot ve doc thang CSDL, khong chan request: phan quyen la duong di
   * bat buoc cua moi thao tac, khong the phu thuoc vao mot thanh phan cache.
   */
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

  /** Ma tran day du cho man hinh quan tri - doc thang CSDL, khong qua cache. */
  async getMatrix(): Promise<RolePermissionMatrixRow[]> {
    const rows = await this.rolePermissionsRepository.find();
    return STAFF_ROLES.map((role) => ({
      role,
      permissions: rows.filter((row) => row.role === role).map((row) => row.permission),
    }));
  }

  /** Danh muc quyen kem cach nhom - phuc vu hien thi, khong phai du lieu CSDL. */
  getCatalog(): PermissionCatalogEntry[] {
    return Object.entries(PERMISSION_GROUPS).map(([group, permissions]) => ({
      group,
      permissions,
    }));
  }

  /**
   * Thay toan bo tap quyen cua mot vai tro (xoa het roi ghi lai) trong mot transaction.
   *
   * Hai rao chan co chu dich:
   *   1. Khong sua duoc quyen cua ADMIN. BR-16 giao viec quan ly phan quyen cho Admin;
   *      neu cho phep go quyen cua chinh Admin thi quan tri vien co the tu khoa minh
   *      ra ngoai va khong con duong nao vao lai ngoai viec sua truc tiep CSDL.
   *   2. Khong sua duoc quyen cua PET_OWNER: chu thu cung khong di qua endpoint nhan
   *      vien nao, ma tran nay khong ap dung cho ho.
   */
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

  /** Tra mot vai tro ve ma tran mac dinh cua SRS (nut "khoi phuc mac dinh"). */
  async resetRoleToDefault(role: Role): Promise<Permission[]> {
    return this.setRolePermissions(role, DEFAULT_ROLE_PERMISSIONS[role] ?? []);
  }

  private cacheKey(role: Role): string {
    return `permissions:role:${role}`;
  }
}
