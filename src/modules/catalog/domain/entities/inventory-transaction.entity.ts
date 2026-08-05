import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import {
  InventoryReferenceType,
  InventoryTransactionType,
} from '@/shared/common/enums/inventory-transaction-type.enum';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { InventoryBatch } from './inventory-batch.entity';
import { InventoryItem } from './inventory-item.entity';

/**
 * So cai xuat-nhap kho - SRS FR-18-02.
 *
 * DAY LA BAN GHI BAT BIEN. Khong sua, khong xoa - ke ca xoa mem. Ghi sai thi ghi mot
 * dong dieu chinh nguoc lai. Ly do: bang nay la nguon su that de doi soat khi so tong
 * bi nghi ngo lech, va la dau vao cua bao cao kho o P10. Mot so cai sua duoc thi
 * khong con doi soat duoc gi.
 *
 * KHONG ke thua `BaseEntity` - cung ly do voi `OutboxEvent`: khong can `updated_at`
 * (dong khong bao gio doi) va khong duoc phep co `deleted_at` (`@DeleteDateColumn` se
 * am tham loc bot dong khoi moi truy van, va mot so cai co the loc bot dong thi bat
 * bien SUM(quantity_change) = inventory_quantity mat y nghia).
 *
 * `quantityAfter` la ton NGAY SAU giao dich nay. Ve ly thuyet no thua - cong don
 * `quantityChange` la ra. Giu lai vi khi ton thuc te lech so voi tong so cai, so sanh
 * `quantityAfter` cua cac dong lien tiep cho biet NGAY dong nao lam lech, thay vi chi
 * biet "o dau do trong 10.000 dong".
 */
@Entity({ name: 'inventory_transactions' })
// Man hinh so cai va bao cao kho deu loc theo (item, thoi diem).
@Index('idx_inventory_transactions_item_created', ['inventoryItemId', 'createdAt'])
@Index('idx_inventory_transactions_branch_created', ['branchId', 'createdAt'])
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem: InventoryItem;

  @Column({ name: 'inventory_item_id' })
  inventoryItemId: string;

  /**
   * Lo bi anh huong. Nullable: dieu chinh kiem ke o muc item (khong quy duoc ve lo
   * nao) va cac mat hang khong quan ly theo lo van phai ghi duoc so cai.
   *
   * `ON DELETE SET NULL` chu khong CASCADE: xoa mot lo khong duoc phep lam bien mat
   * lich su cua no.
   */
  @ManyToOne(() => InventoryBatch, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch: InventoryBatch | null;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId: string | null;

  /**
   * Nhan ban tu `inventoryItem.branchId` co chu dich: moi truy van bao cao deu loc
   * theo chi nhanh, va bat chung join qua `inventory_items` chi de lay mot cot khong
   * bao gio doi la lang phi.
   */
  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'type', type: 'enum', enum: InventoryTransactionType })
  type: InventoryTransactionType;

  /** Am hoac duong, khong bao gio bang 0 (CHECK o CSDL). */
  @Column({ name: 'quantity_change', type: 'integer' })
  quantityChange: number;

  /** Ton cua `InventoryItem` ngay sau giao dich - de doi soat, xem comment dau lop. */
  @Column({ name: 'quantity_after', type: 'integer' })
  quantityAfter: number;

  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: InventoryReferenceType,
    default: InventoryReferenceType.MANUAL,
  })
  referenceType: InventoryReferenceType;

  /** Id cua chung tu goc. Nullable vi `MANUAL` khong co chung tu nao. */
  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  /**
   * Nguoi thuc hien. `ON DELETE SET NULL`: nhan vien nghi viec khong duoc lam mat
   * dong so cai, nhung dau vet ai lam thi mat - do la danh doi chap nhan duoc so voi
   * viec chan xoa tai khoan.
   */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'performed_by_user_id' })
  performedByUser: User | null;

  @Column({ name: 'performed_by_user_id', type: 'uuid', nullable: true })
  performedByUserId: string | null;

  /** Ly do - BAT BUOC ve mat nghiep vu voi ADJUSTMENT/DAMAGED/LOSS. */
  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
