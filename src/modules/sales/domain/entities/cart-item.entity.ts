import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { Cart } from './cart.entity';

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

  @Column({ name: 'unit_price', type: 'bigint', transformer: moneyTransformer })
  unitPrice: number;
}
