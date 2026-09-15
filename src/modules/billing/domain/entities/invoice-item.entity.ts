import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Invoice } from './invoice.entity';
import { Item } from '@/modules/catalog/domain/entities/item.entity';

@Entity({ name: 'invoice_items' })
export class InvoiceItem extends BaseEntity {
  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => Item, (item) => item.invoiceItems, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'price', type: 'bigint', transformer: moneyTransformer })
  price: number;

  @Column({ name: 'quantity', type: 'integer', default: 1 })
  quantity: number;
}
