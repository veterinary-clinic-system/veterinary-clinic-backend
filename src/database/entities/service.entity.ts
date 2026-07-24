import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Item } from './item.entity';

/**
 * Not a distinct box in diagram.jpg - added to satisfy prompt.md Section 4.1.2
 * ("PetOwner/Guest books online by service") and Section 5.1's 4.1.5 price-list
 * requirement. Extends Item 1:1 with the fields the booking flow needs
 * (appointment duration, which specialization can perform it) while Item keeps
 * owning price/stock so it still plugs into InvoiceItem/InventoryItem unchanged.
 */
@Entity({ name: 'services' })
export class Service extends BaseEntity {
  @OneToOne(() => Item, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'duration_minutes', type: 'smallint', default: 30 })
  durationMinutes: number;

  @Column({ name: 'requires_specialization', type: 'varchar', nullable: true })
  requiresSpecialization: string | null;

  @Column({ name: 'active', default: true })
  active: boolean;
}
