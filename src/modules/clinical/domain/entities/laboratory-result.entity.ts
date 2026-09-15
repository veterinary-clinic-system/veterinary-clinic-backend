import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { numericTransformer } from '@/shared/database/transformers/numeric.transformer';
import { LabResultFlag } from '@/shared/common/enums/lab-result-flag.enum';
import { LabTestOrder } from './lab-test-order.entity';

@Entity({ name: 'laboratory_results' })
@Index(['labTestOrderId'])
export class LaboratoryResult extends BaseEntity {
  @ManyToOne(() => LabTestOrder, (order) => order.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_test_order_id' })
  labTestOrder: LabTestOrder;

  @Column({ name: 'lab_test_order_id' })
  labTestOrderId: string;

  @Column({ name: 'parameter', length: 100 })
  parameter: string;

  @Column({
    name: 'value',
    type: 'numeric',
    precision: 14,
    scale: 4,
    transformer: numericTransformer,
  })
  value: number;

  @Column({ name: 'unit', type: 'varchar', length: 50, nullable: true })
  unit: string | null;

  @Column({
    name: 'reference_min',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
    transformer: numericTransformer,
  })
  referenceMin: number | null;

  @Column({
    name: 'reference_max',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
    transformer: numericTransformer,
  })
  referenceMax: number | null;

  @Column({ name: 'flag', type: 'enum', enum: LabResultFlag, default: LabResultFlag.NORMAL })
  flag: LabResultFlag;

  @Column({ name: 'flag_overridden', default: false })
  flagOverridden: boolean;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;
}
