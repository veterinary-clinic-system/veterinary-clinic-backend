import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { EmployeeStatus } from '@/shared/common/enums/employee-status.enum';
import { User } from './user.entity';

/**
 * Ho so NHAN SU - SRS FR-22.
 *
 * Vi sao tach khoi `User` va khoi `Doctor`:
 *   - `User` la TAI KHOAN DANG NHAP (so dien thoai, mat khau, vai tro). Rat nhieu nhan
 *     vien khong bao gio dang nhap he thong (tap vu, bao ve, ky thuat vien), nhung van
 *     phai co trong danh sach nhan su - nen `userId` o day la TUY CHON.
 *   - `Doctor` la HO SO CHUYEN MON (chuyen khoa, nam hanh nghe, ca truc). Mot bac si co
 *     ca ba ban ghi: User (dang nhap), Doctor (chuyen mon), Employee (nhan su). Gop
 *     chung se bat moi le tan phai co cot "chuyen khoa" va moi bac si phai co cot
 *     "ngay vao lam" trong cung mot bang.
 *
 * Ba khai niem nay noi voi nhau qua `userId`.
 */
@Entity({ name: 'employees' })
export class Employee extends BaseEntity {
  /** Ma nhan vien doc duoc, sinh tu sequence trong migration. */
  @Column({ name: 'employee_code', length: 32 })
  @Index({ unique: true })
  employeeCode: string;

  /** Tai khoan dang nhap tuong ung. Null = nhan vien khong dung he thong. */
  @OneToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId: string | null;

  @Column({ name: 'full_name', length: 255 })
  fullName: string;

  @Column({ name: 'phone', length: 20 })
  phone: string;

  @Column({ name: 'email', type: 'varchar', nullable: true, length: 255 })
  email: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  /** Chuc danh tu do ("Bac si truong", "Le tan ca sang") - khac voi `User.role`. */
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
