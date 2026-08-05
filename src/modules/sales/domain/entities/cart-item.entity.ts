import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { Cart } from './cart.entity';

/**
 * Mot dong trong gio hang POS.
 *
 * `unitPrice` o day la gia LUC THEM VAO GIO - dung de hien tren man hinh va tinh tam
 * tinh. No KHONG phai gia cuoi cung: luc thanh toan (P8-T5) gia duoc doc lai tu danh muc
 * va chot vao `invoice_items`. Ly do: mot gio mo tu sang co the con do den chieu, va gia
 * tren hoa don phai la gia tai thoi diem thu tien - do la con so khach nhin thay o man
 * hinh thanh toan va la con so ghi vao so sach.
 */
@Entity({ name: 'cart_items' })
@Index('uq_cart_items_cart_item', ['cartId', 'itemId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class CartItem extends BaseEntity {
  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @Column({ name: 'cart_id' })
  cartId: string;

  @ManyToOne(() => Item, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'quantity', type: 'integer', default: 1 })
  quantity: number;

  /** Gia hien tren man hinh luc them vao gio - xem comment dau lop. */
  @Column({ name: 'unit_price', type: 'bigint', transformer: moneyTransformer })
  unitPrice: number;
}
