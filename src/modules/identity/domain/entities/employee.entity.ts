import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { DEFAULT_STAFF_IMAGE } from '@/shared/storage/cloudinary-web-assets';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { EmployeeStatus } from '@/shared/common/enums/employee-status.enum';
import { User } from './user.entity';

@Entity({ name: 'employees' })
export class Employee extends BaseEntity {
  
  @Column({ name: 'employee_code', length: 32 })
  @Index({ unique: true })
  employeeCode: string;

  @OneToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId: string | null;

  @Column({ name: 'full_name', length: 255 })
  fullName: string;

  @Column({ name: 'avatar_url', type: 'varchar', default: DEFAULT_STAFF_IMAGE })
  avatarUrl: string;

  @Column({ name: 'phone', length: 20 })
  phone: string;

  @Column({ name: 'email', type: 'varchar', nullable: true, length: 255 })
  email: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'position', type: 'varchar', nullable: true, length: 128 })
  position: string | null;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch | null;

  @Column({ name: 'branch_id', type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ name: 'hire_date', type: 'date', nullable: true })
  hireDate: string | null;

  @Column({ name: 'resigned_date', type: 'date', nullable: true })
  resignedDate: string | null;

  @Column({ type: 'enum', enum: EmployeeStatus, default: EmployeeStatus.PROBATION })
  status: EmployeeStatus;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;
}
