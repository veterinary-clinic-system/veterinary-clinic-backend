import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Item } from './item.entity';

@Entity({ name: 'products' })
export class Product extends BaseEntity {
  @OneToOne(() => Item, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Index('idx_products_sku')
  @Column({ name: 'sku', length: 64 })
  sku: string;

  @Column({ name: 'brand', type: 'varchar', length: 255, nullable: true })
  brand: string | null;

  @Column({ name: 'unit', length: 50 })
  unit: string;

  @Column({ name: 'cost_price', type: 'bigint', default: 0, transformer: moneyTransformer })
  costPrice: number;

  @Column({ name: 'minimum_stock', type: 'int', default: 0 })
  minimumStock: number;

  @Column({ name: 'active', default: true })
  active: boolean;
}
