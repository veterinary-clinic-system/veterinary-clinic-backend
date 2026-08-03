import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { User } from './user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Specialization } from '@/shared/common/enums/specialization.enum';
import { DoctorShift } from '@/modules/scheduling/domain/entities/doctor-shift.entity';
import { DoctorBreak } from '@/modules/scheduling/domain/entities/doctor-break.entity';

/**
 * diagram.jpg `Doctor` box. 1:1 with `User` (login/credentials live on User; clinical
 * profile lives here) and many-to-one with `Branch` (a doctor staffs exactly one branch,
 * per the "1..*" Doctor / "1" Branch multiplicities in diagram.jpg and the
 * multi-branch rule in prompt.md Section 4.2).
 */
@Entity({ name: 'doctors' })
export class Doctor extends BaseEntity {
  @OneToOne(() => User, (user) => user.doctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Branch, (branch) => branch.doctors, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'active', default: true })
  active: boolean;

  @Column({ name: 'full_name', length: 255 })
  fullName: string;

  @Column({ name: 'year_of_start', type: 'smallint', nullable: true })
  yearOfStart: number | null;

  @Column({ type: 'enum', enum: Specialization, array: true, default: [] })
  specialization: Specialization[];

  @OneToMany(() => DoctorShift, (shift) => shift.doctor)
  shifts?: DoctorShift[];

  @OneToMany(() => DoctorBreak, (b) => b.doctor)
  breaks?: DoctorBreak[];
}
