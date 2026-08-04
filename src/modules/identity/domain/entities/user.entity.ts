import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Role } from '@/shared/common/enums/role.enum';
import { Doctor } from './doctor.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { RefreshToken } from './refresh-token.entity';

/**
 * diagram.jpg `User` box. Covers every role's account (Admin, Receptionist,
 * PetOwner, and the login-credentials half of Doctor). `branchId` is not on the
 * diagram - added so Receptionist/Admin accounts can be scoped to the branch they
 * staff (null branch = HQ/global Admin), mirroring how Doctor is branch-scoped.
 */
@Entity({ name: 'users' })
export class User extends BaseEntity {
  /**
   * Ma khach hang doc duoc tai quay (`KH000123`) - SRS FR-03-01.
   *
   * CHI khach hang (`role = PET_OWNER`) co ma; tai khoan nhan vien de NULL (ho co
   * `employees.employee_code` rieng). Gia tri do trigger `trg_assign_customer_code`
   * cap o tang CSDL nen `insert/update: false` - ung dung khong bao gio ghi cot nay,
   * chi doc lai sau khi luu.
   */
  @Column({
    name: 'customer_code',
    type: 'varchar',
    length: 32,
    nullable: true,
    insert: false,
    update: false,
  })
  customerCode: string | null;

  @Column({ name: 'phone', unique: true, length: 20 })
  @Index()
  phone: string;

  @Column({ name: 'email', type: 'varchar', unique: true, nullable: true, length: 255 })
  email: string | null;

  @Column({ name: 'full_name', length: 255 })
  fullName: string;

  @Column({ name: 'password_hash', type: 'varchar', select: false, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'enum', enum: Role, default: Role.PET_OWNER })
  role: Role;

  @Column({ name: 'active', default: true })
  active: boolean;

  @Column({ name: 'branch_id', type: 'varchar', nullable: true })
  branchId: string | null;

  /**
   * Ho so khach hang (Role.PET_OWNER) can dia chi de giao thuoc / goi tai nha va mot
   * o ghi chu tu do cho le tan ("khach quen", "chi lien he qua Zalo"). Khong co trong
   * diagram.jpg - `Appointment.address` chi la dia chi cua RIENG mot lan hen, khong
   * thay the duoc dia chi thuong tru cua khach. Voi tai khoan nhan vien hai cot nay
   * de trong.
   */
  /** Ngay sinh khach hang (FR-03-01). Tai khoan nhan vien de trong. */
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @OneToOne(() => Doctor, (doctor) => doctor.user)
  doctorProfile?: Doctor;

  @OneToMany(() => Pet, (pet) => pet.owner)
  pets?: Pet[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens?: RefreshToken[];
}
