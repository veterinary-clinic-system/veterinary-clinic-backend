import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { StockTakeStatus } from '@/shared/common/enums/stock-take-status.enum';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { StockTakeItem } from './stock-take-item.entity';

/**
 * Phieu kiem ke - SRS FR-18-03.
 *
 * Khac phieu nhap (`GoodsReceipt`, khong co trang thai): kiem ke CO hai buoc that su.
 * Chup so ton roi di dem kho co the mat ca buoi, va so dem duoc nhap dan trong luc do.
 * Ton chi doi khi XAC NHAN, va xac nhan la mot lan duy nhat.
 *
 * `systemQuantity` cua tung dong duoc chup luc TAO phieu chu khong luc xac nhan: chenh
 * lech phai la chenh lech so voi cai kho noi tai thoi diem bat dau dem. Neu doc lai luc
 * xac nhan thi mot lan ban hang xen giua se bien thanh "that thoat".
 */
@Entity({ name: 'stock_takes' })
@Index('idx_stock_takes_branch_status', ['branchId', 'status'])
export class StockTake extends BaseEntity {
  /** `KK00001`... Do cot DEFAULT cap khi INSERT. */
  @Column({ name: 'stock_take_code', length: 32 })
  stockTakeCode: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: StockTakeStatus,
    default: StockTakeStatus.DRAFT,
  })
  status: StockTakeStatus;

  @Column({ name: 'taken_date', type: 'date' })
  takenDate: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'confirmed_by_user_id' })
  confirmedByUser: User | null;

  @Column({ name: 'confirmed_by_user_id', type: 'uuid', nullable: true })
  confirmedByUserId: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  /** Ly do chung cua ca phieu. Tung dong co the ghi ly do rieng. */
  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => StockTakeItem, (line) => line.stockTake)
  items?: StockTakeItem[];
}
