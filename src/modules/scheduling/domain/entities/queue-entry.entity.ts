import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { CommonSymptom } from '@/shared/common/enums/common-symptom.enum';
import { QueueSource, QueueStatus } from '@/shared/common/enums/queue-status.enum';
import { Appointment } from './appointment.entity';

@Entity({ name: 'queue_entries' })
@Index(['branch', 'queueDate', 'status'])
export class QueueEntry extends BaseEntity {
  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => Pet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({ name: 'pet_id' })
  petId: string;

  @ManyToOne(() => Appointment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  @Column({ name: 'appointment_id', type: 'varchar', nullable: true })
  appointmentId: string | null;

  @ManyToOne(() => Doctor, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor | null;

  @Column({ name: 'doctor_id', type: 'varchar', nullable: true })
  doctorId: string | null;

  @ManyToOne(() => Service, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'service_id' })
  serviceId: string;

  @Column({ name: 'queue_date', type: 'date' })
  queueDate: string;

  @Column({ name: 'ticket_number', type: 'integer' })
  ticketNumber: number;

  @Column({ type: 'enum', enum: QueueStatus, default: QueueStatus.WAITING })
  status: QueueStatus;

  @Column({ type: 'enum', enum: QueueSource })
  source: QueueSource;

  @Column({ name: 'priority_color', type: 'enum', enum: PriorityColor, nullable: true })
  priorityColor: PriorityColor | null;

  @Column({ name: 'common_symptoms', type: 'enum', enum: CommonSymptom, array: true, default: [] })
  commonSymptoms: CommonSymptom[];

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'photo_urls', type: 'text', array: true, default: [] })
  photoUrls: string[];

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'checked_in_at', type: 'timestamptz', default: () => 'now()' })
  checkedInAt: Date;

  @Column({ name: 'called_at', type: 'timestamptz', nullable: true })
  calledAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User | null;

  @Column({ name: 'created_by_user_id', type: 'varchar', nullable: true })
  createdByUserId: string | null;
}
