import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from '@/shared/common/enums/permission.enum';
import { Role } from '@/shared/common/enums/role.enum';

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
