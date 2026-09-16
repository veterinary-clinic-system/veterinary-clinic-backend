import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { DEFAULT_USER_IMAGE } from '@/shared/storage/cloudinary-web-assets';
import { Role } from '@/shared/common/enums/role.enum';
import { Doctor } from './doctor.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { RefreshToken } from './refresh-token.entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  
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

  @Column({ name: 'avatar_url', type: 'varchar', default: DEFAULT_USER_IMAGE })
  avatarUrl: string;

  @Column({ name: 'password_hash', type: 'varchar', select: false, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'enum', enum: Role, default: Role.PET_OWNER })
  role: Role;

  @Column({ name: 'active', default: true })
  active: boolean;

  @Column({ name: 'branch_id', type: 'varchar', nullable: true })
  branchId: string | null;

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
