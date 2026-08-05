import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { InventoryItem } from './inventory-item.entity';
import { Supplier } from './supplier.entity';

/**
 * Lo hang - SRS FR-18-01, BR-11.
 *
 * `InventoryItem` tra loi "chi nhanh nay con bao nhieu", `InventoryBatch` tra loi
 * "bao nhieu do nam o nhung lo nao, han den bao gio, nhap gia bao nhieu". Khong the
 * gop hai cau hoi vao mot bang: cung mot loai thuoc thuong ton dong thoi nhieu lo
 * khac han su dung, va FEFO (xuat lo het han som nhat truoc) chi thuc hien duoc khi
 * tung lo la mot dong rieng.
 *
 * QUAN HE VOI SO TONG: `inventoryItem.inventoryQuantity` la BAN CACHE cua
 * `SUM(batches.quantity)` - quyet dinh (B) o phase-06. No duoc cap nhat trong CUNG
 * transaction voi lo, boi CHI `InventoryService`. Xem comment dau service do.
 *
 * `costPrice` nam o lo chu khong o `Product`/`Medication`: gia nhap doi theo tung dot,
 * va bao cao gia von hang ban phai lay dung gia cua lo da xuat, khong phai gia hien
 * hanh cua danh muc.
 */
@Entity({ name: 'inventory_batches' })
@Index(['inventoryItemId', 'batchNo'], { unique: true })
export class InventoryBatch extends BaseEntity {
  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem: InventoryItem;

  @Column({ name: 'inventory_item_id' })
  inventoryItemId: string;

  /** Ma lo in tren vo hop cua nha san xuat. Duy nhat trong pham vi mot `InventoryItem`. */
  @Column({ name: 'batch_no', length: 64 })
  batchNo: string;

  /**
   * Nullable CO CHU DICH: SRS FR-18 phu ca hang khong han dung (vong co, lo, do dung).
   * Bat buoc nhap han cho moi mat hang se khien nhan vien bia mot ngay bat ky, va
   * canh bao "sap het han" tu do tro thanh nhieu.
   *
   * `date` chu khong phai `timestamptz`: han dung la mot ngay tren bao bi, no khong
   * doi theo mui gio cua nguoi doc.
   */
  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  /** So luong con lai cua lo. CHECK >= 0 o CSDL - NFR-07 "ton kho khong duoc am". */
  @Column({ name: 'quantity', type: 'integer', default: 0 })
  quantity: number;

  /** Gia nhap cua lo, tinh bang DONG - Phan V.4 quyet dinh #2. */
  @Column({ name: 'cost_price', type: 'bigint', default: 0, transformer: moneyTransformer })
  costPrice: number;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'now()' })
  receivedAt: Date;

  /**
   * Nha cung cap da giao lo nay. `ON DELETE SET NULL` cung ly do voi `Medication`:
   * ngung hop tac khong duoc lam mat dau vet lo hang da nhap.
   */
  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @Column({ name: 'supplier_id', type: 'varchar', nullable: true })
  supplierId: string | null;

  /**
   * Phieu nhap da sinh ra lo. Khong khai bao `@ManyToOne` va khong co khoa ngoai o
   * migration nay: bang `goods_receipts` chi ra doi o P6-T5, va migration cua T5 la
   * noi them rang buoc khoa ngoai. Giu la uuid tran o day de moi task van chay duoc
   * doc lap (quy uoc "moi task xong la code van build duoc" o README ke hoach).
   *
   * Nullable vinh vien du sau khi co khoa ngoai: lo con vao kho bang duong kiem ke
   * (P6-T6) hoac dieu chinh tay, khong phai lo nao cung tu mot phieu nhap.
   */
  @Column({ name: 'goods_receipt_id', type: 'uuid', nullable: true })
  goodsReceiptId: string | null;
}
