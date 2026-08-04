import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from '@/shared/common/enums/permission.enum';
import { Role } from '@/shared/common/enums/role.enum';

/**
 * Mot o trong ma tran (vai tro x quyen) - SRS FR-02.
 *
 * Vi sao KHONG co bang `roles` va bang `permissions` rieng:
 *   - `Role` da la kieu enum cua Postgres, dung lam cot `users.role`. Dung mot bang
 *     `roles` song song se tao ra hai nguon su that cho cung mot khai niem.
 *   - `Permission` la enum trong ma nguon vi ma quyen duoc go cung vao
 *     `@RequirePermissions(...)` tren tung handler - xem ghi chu trong permission.enum.ts.
 * Cai duy nhat thuc su la DU LIEU, va thuc su can quan tri vien sua duoc, la anh xa
 * giua hai thu do. Bang nay chinh la anh xa ay.
 *
 * KHONG ke thua `BaseEntity`: day la bang tra cuu thuan, mot cap (role, permission) chi
 * co hoac khong. Xoa mem mot dong phan quyen la vo nghia - va con nguy hiem, vi mot
 * dong da xoa mem van chiem cho trong chi muc duy nhat.
 */
@Entity({ name: 'role_permissions' })
@Index(['role', 'permission'], { unique: true })
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column({ type: 'enum', enum: Permission })
  permission: Permission;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
