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

  @OneToOne(() => Doctor, (doctor) => doctor.user)
  doctorProfile?: Doctor;

  @OneToMany(() => Pet, (pet) => pet.owner)
  pets?: Pet[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens?: RefreshToken[];
}
