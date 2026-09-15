import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Item } from './item.entity';
import { Supplier } from './supplier.entity';

@Entity({ name: 'medications' })
export class Medication extends BaseEntity {
  @OneToOne(() => Item, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'unit', length: 50 })
  unit: string;

  @Column({ name: 'active_ingredient', type: 'varchar', length: 255, nullable: true })
  activeIngredient: string | null;

  @Column({ name: 'generic_name', type: 'varchar', length: 255, nullable: true })
  genericName: string | null;

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
