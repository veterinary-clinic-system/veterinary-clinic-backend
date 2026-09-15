import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Species } from '@/modules/pets/domain/entities/species.entity';
import { Item } from './item.entity';
import { Supplier } from './supplier.entity';

@Entity({ name: 'vaccines' })
export class Vaccine extends BaseEntity {
  @OneToOne(() => Item, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'disease_prevented', length: 255 })
  diseasePrevented: string;

  @ManyToMany(() => Species)
  @JoinTable({
    name: 'vaccine_species',
    joinColumn: { name: 'vaccine_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'species_id', referencedColumnName: 'id' },
  })
  speciesApplicable?: Species[];

  @Column({ name: 'dose_count', type: 'int', default: 1 })
  doseCount: number;

  @Column({ name: 'interval_days', type: 'int', nullable: true })
  intervalDays: number | null;

  @Column({ name: 'booster_interval_days', type: 'int', nullable: true })
  boosterIntervalDays: number | null;

  @Column({ name: 'manufacturer', type: 'varchar', length: 255, nullable: true })
  manufacturer: string | null;

  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @Column({ name: 'supplier_id', type: 'varchar', nullable: true })
  supplierId: string | null;

  @Column({ name: 'cost_price', type: 'bigint', default: 0, transformer: moneyTransformer })
  costPrice: number;

  @Column({ name: 'minimum_stock', type: 'int', default: 0 })
  minimumStock: number;

  @Column({ name: 'active', default: true })
  active: boolean;
}
