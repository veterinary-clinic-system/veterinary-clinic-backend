import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Doctor } from './doctor.entity';

/**
 * Not in diagram.jpg - added to represent one-off unavailability (a single day's
 * lunch overrun, a sick day, vacation) that carves time out of an otherwise
 * recurring DoctorShift, per the "doesn't overlap the doctor's break time" rule
 * in prompt.md Section 5.1. `date` + start/end let this be a single afternoon off
 * or, when startTime/endTime span the whole working day, a full day off.
 */
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
