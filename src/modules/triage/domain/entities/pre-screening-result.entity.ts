import { Column, Entity, JoinColumn, JoinTable, ManyToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { Disease } from '@/modules/catalog/domain/entities/disease.entity';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';

@Entity({ name: 'pre_screening_results' })
export class PreScreeningResult extends BaseEntity {
  @OneToOne(() => Appointment, (appointment) => appointment.preScreeningResult, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id' })
  appointmentId: string;

  @Column({ name: 'symptom_text', type: 'text' })
  symptomText: string;

  @ManyToMany(() => Disease)
  @JoinTable({
    name: 'pre_screening_disease_groups',
    joinColumn: { name: 'pre_screening_result_id' },
    inverseJoinColumn: { name: 'disease_id' },
  })
  aiSuspectedDiseaseGroups: Disease[];

  @Column({ name: 'ai_priority_color', type: 'enum', enum: PriorityColor })
  aiPriorityColor: PriorityColor;

  @Column({ name: 'extracted_symptom_keywords', type: 'text', array: true, default: [] })
  extractedSymptomKeywords: string[];

  @Column({ name: 'nlp_confidence', type: 'numeric', precision: 4, scale: 3, nullable: true })
  nlpConfidence: number | null;

  @Column({ name: 'cv_confidence', type: 'numeric', precision: 4, scale: 3, nullable: true })
  cvConfidence: number | null;

  @Column({ name: 'overall_confidence', type: 'numeric', precision: 4, scale: 3 })
  overallConfidence: number;

  @Column({ name: 'model_version', type: 'varchar', length: 64, default: 'unknown' })
  modelVersion: string;

  @Column({ name: 'raw_ai_response', type: 'jsonb', nullable: true })
  rawAiResponse: Record<string, unknown> | null;
}
