import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';

@Entity({ name: 'doctor_breaks' })
@Index(['doctor', 'date'])
export class DoctorBreak extends BaseEntity {
  @ManyToOne(() => Doctor, (doctor) => doctor.breaks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  @Column({ name: 'date', type: 'date' })
  date: string;

  @Column({ name: 'start_time', length: 5 })
  startTime: string;

  @Column({ name: 'end_time', length: 5 })
  endTime: string;

  @Column({ name: 'reason', type: 'varchar', length: 255, nullable: true })
  reason: string | null;
}
