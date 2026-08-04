import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Item } from './item.entity';
import { Supplier } from './supplier.entity';

/**
 * Not a distinct box in diagram.jpg - added for the shared medication catalog
 * required by prompt.md Section 6 (Admin) and Section 4.1.4 (prescribing).
 * Extends Item 1:1 the same way Service does.
 *
 * LO VA HAN SU DUNG KHONG NAM O DAY (SRS FR-15 co nhac toi): mot loai thuoc co nhieu
 * lo cung luc, moi lo mot han va mot so luong con lai. Nhet `batchNumber`/`expiryDate`
 * vao day thi chi giu duoc mot lo. Do la viec cua `InventoryBatch` o P6.
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

  /**
   * Ten goc (INN) - SRS FR-15. Khac `activeIngredient` o cho: hoat chat la thanh phan
   * hoa hoc, con ten goc la ten thuoc khong mang thuong hieu ("Paracetamol" so voi
   * "Panadol"). Duoc si tim thuoc thay the theo ten goc.
   */
  @Column({ name: 'generic_name', type: 'varchar', length: 255, nullable: true })
  genericName: string | null;

  @Column({ name: 'manufacturer', type: 'varchar', length: 255, nullable: true })
  manufacturer: string | null;

  /**
   * Nha cung cap thuong nhap thuoc nay. Nullable va `ON DELETE SET NULL`: ngung hop tac
   * voi mot nha cung cap khong duoc lam bien mat thuoc khoi danh muc.
   *
   * Day chi la GOI Y cho don nhap hang o P6, khong phai rang buoc - cung mot loai thuoc
   * co the nhap tu nhieu noi tuy dot.
   */
  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @Column({ name: 'supplier_id', type: 'varchar', nullable: true })
  supplierId: string | null;

  /** Gia von tinh bang DONG - cung ly do voi `Product.costPrice`. */
  @Column({ name: 'cost_price', type: 'bigint', default: 0, transformer: moneyTransformer })
  costPrice: number;

  @Column({ name: 'minimum_stock', type: 'int', default: 0 })
  minimumStock: number;

  @Column({ name: 'active', default: true })
  active: boolean;
}
