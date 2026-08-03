import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';

/**
 * Not in diagram.jpg - added because prompt.md Section 4.1.2 requires "Receptionist
 * also manages doctor shifts" and Section 5.2's calendar needs a per-doctor recurring
 * working-block source distinct from the branch's own OperatingHour. One row = one
 * recurring weekly working block (e.g. Doctor X, Monday, 07:00-11:00).
 */
@Entity({ name: 'doctor_shifts' })
@Index(['doctor', 'dayOfWeek'])
export class DoctorShift extends BaseEntity {
  @ManyToOne(() => Doctor, (doctor) => doctor.shifts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  /** JS `Date#getDay()` convention: 0 (Sunday) - 6 (Saturday). Matches OperatingHour.dayOfWeek. */
  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  @Column({ name: 'start_time', length: 5 })
  startTime: string;

  @Column({ name: 'end_time', length: 5 })
  endTime: string;

  @Column({ name: 'active', default: true })
  active: boolean;
}
