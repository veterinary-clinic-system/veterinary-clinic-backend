import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Item } from './item.entity';

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
