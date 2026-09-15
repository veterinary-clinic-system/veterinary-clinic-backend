import { Column, Entity, JoinColumn, JoinTable, ManyToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Appointment } from './appointment.entity';
import { Disease } from './disease.entity';
import { PriorityColor } from '@/common/enums/priority-color.enum';

/**
 * diagram.jpg `PreScreeningResult` box - the AI's raw triage output for an appointment,
 * kept immutable as an audit trail even after staff override `Appointment.priorityColor`
 * (see prompt.md Section 4.1.6, "track how often staff accept vs override"). Fields
 * beyond `aiSuspectedDiseaseGroups`/`aiPriorityColor` were added to satisfy Section 6's
 * "extracted symptom keywords, confidence" requirement, which the diagram's two-attribute
 * box didn't itemize.
 */
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

  /** 0-1 confidence from the NLP text-triage step. */
  @Column({ name: 'nlp_confidence', type: 'numeric', precision: 4, scale: 3, nullable: true })
  nlpConfidence: number | null;

  /** 0-1 confidence from the CV image-classification step; null when no photos were sent. */
  @Column({ name: 'cv_confidence', type: 'numeric', precision: 4, scale: 3, nullable: true })
  cvConfidence: number | null;

  /** Combined confidence the AI service reported for the final priority color. */
  @Column({ name: 'overall_confidence', type: 'numeric', precision: 4, scale: 3 })
  overallConfidence: number;

  /** Full raw response from veterinary-clinic-ai, kept for audit/debugging. */
  @Column({ name: 'raw_ai_response', type: 'jsonb', nullable: true })
  rawAiResponse: Record<string, unknown> | null;
}
