import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { CommonSymptom } from '@/shared/common/enums/common-symptom.enum';

/**
 * diagram.jpg `Disease` box - a disease/issue "group" the AI's CV/NLP pipeline and the
 * doctor both classify against (e.g. "Skin allergy", "Ear infection").
 */
@Entity({ name: 'diseases' })
export class Disease extends BaseEntity {
  @Column({ name: 'disease_name', length: 255, unique: true })
  diseaseName: string;

  @Column({ type: 'enum', enum: CommonSymptom, array: true, default: [] })
  commonSymptoms: CommonSymptom[];

  @Column({ name: 'other_symptoms', type: 'text', nullable: true })
  otherSymptoms: string | null;
}
