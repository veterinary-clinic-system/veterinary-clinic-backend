import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Invoice } from './invoice.entity';
import { Item } from './item.entity';

/** diagram.jpg `InvoiceItem` box - one billed line, price snapshot at invoice time. */
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

  @Column({ name: 'price', type: 'numeric', precision: 12, scale: 2 })
  price: number;

  @Column({ name: 'quantity', type: 'integer', default: 1 })
  quantity: number;
}
