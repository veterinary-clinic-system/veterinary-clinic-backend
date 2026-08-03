import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Item } from './item.entity';

/**
 * Not a distinct box in diagram.jpg - added for the shared medication catalog
 * required by prompt.md Section 6 (Admin) and Section 4.1.4 (prescribing).
 * Extends Item 1:1 the same way Service does.
 */
@Entity({ name: 'medications' })
export class Medication extends BaseEntity {
  @OneToOne(() => Item, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  /** e.g. "tablet", "ml", "vial" - the unit dosage is expressed in on a prescription. */
  @Column({ name: 'unit', length: 50 })
  unit: string;

  @Column({ name: 'active_ingredient', type: 'varchar', length: 255, nullable: true })
  activeIngredient: string | null;

  @Column({ name: 'active', default: true })
  active: boolean;
}
