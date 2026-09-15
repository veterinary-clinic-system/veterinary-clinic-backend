import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';

@Entity({ name: 'doctor_shifts' })
@Index(['doctor', 'dayOfWeek'])
export class DoctorShift extends BaseEntity {
  @ManyToOne(() => Doctor, (doctor) => doctor.shifts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  @Column({ name: 'start_time', length: 5 })
  startTime: string;

  @Column({ name: 'end_time', length: 5 })
  endTime: string;

  @Column({ name: 'active', default: true })
  active: boolean;
}
