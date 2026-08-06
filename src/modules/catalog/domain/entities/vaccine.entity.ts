import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Species } from '@/modules/pets/domain/entities/species.entity';
import { Item } from './item.entity';
import { Supplier } from './supplier.entity';

/**
 * Vaccine - SRS FR-12 (P9-T1).
 *
 * Mo rong `Item` 1:1 y het `Service` / `Medication` / `Product`. Vaccine co gia, ban
 * duoc, va nam trong kho co lo + han dung - tuc la no da la mot mat hang theo dung moi
 * nghia P5/P6 dat ra. Mot bang gia song song se bat POS, hoa don va bao cao phai xu ly
 * them mot nguon nua, doi lai khong duoc gi.
 *
 * LO VA HAN DUNG KHONG NAM O DAY - cung ly do da ghi o `medication.entity.ts`: mot loai
 * vaccine ton dong thoi nhieu lo khac han. Do la viec cua `InventoryBatch` (P6), va la
 * cai lam cho BR-11 ("vaccine het han khong tiem duoc") kiem tra duoc that.
 *
 * PHAC DO (`doseCount` / `intervalDays` / `boosterIntervalDays`) la du lieu cua DANH
 * MUC chu khong phai cua tung mui tiem: no mo ta loai vaccine nay can may mui va cach
 * nhau bao lau. `VaccinationsService` doc chung de tinh `nextDueDate`, roi CHEP ket qua
 * xuong `vaccinations.next_due_date` - sua phac do trong danh muc ve sau khong duoc
 * phep lam doi lich nhac cua nhung mui da tiem.
 */
@Entity({ name: 'vaccines' })
export class Vaccine extends BaseEntity {
  @OneToOne(() => Item, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  /** Benh duoc phong ngua ("Dai", "Care - Parvo - Ho cui"...) - FR-12. */
  @Column({ name: 'disease_prevented', length: 255 })
  diseasePrevented: string;

  /**
   * Loai ap dung. DANH SACH RONG = dung duoc cho moi loai (vaccine dai la mot vi du).
   *
   * Bang noi chu khong phai cot `uuid[]`: `species` la du lieu tham chieu co that trong
   * CSDL, va mot mang uuid tran khong co khoa ngoai nao bao ve - xoa mot loai di thi
   * danh muc vaccine se tro toi cac id khong con ton tai ma khong ai biet.
   */
  @ManyToMany(() => Species)
  @JoinTable({
    name: 'vaccine_species',
    joinColumn: { name: 'vaccine_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'species_id', referencedColumnName: 'id' },
  })
  speciesApplicable?: Species[];

  /** So mui cua phac do co ban. 1 = tiem mot lan la xong. */
  @Column({ name: 'dose_count', type: 'int', default: 1 })
  doseCount: number;

  /**
   * Khoang cach giua cac mui TRONG phac do co ban, tinh bang ngay. Null khi phac do
   * chi co mot mui.
   */
  @Column({ name: 'interval_days', type: 'int', nullable: true })
  intervalDays: number | null;

  /**
   * Khoang nhac lai sau khi da tiem DU phac do (thuong 365 ngay). Null = khong nhac
   * lai - het phac do la het, va khi do mui cuoi khong sinh `nextDueDate`.
   */
  @Column({ name: 'booster_interval_days', type: 'int', nullable: true })
  boosterIntervalDays: number | null;

  @Column({ name: 'manufacturer', type: 'varchar', length: 255, nullable: true })
  manufacturer: string | null;

  /** Goi y nha cung cap cho don nhap hang - cung quy uoc voi `Medication.supplier`. */
  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @Column({ name: 'supplier_id', type: 'varchar', nullable: true })
  supplierId: string | null;

  /** Gia von tinh bang DONG - Phan V.4 quyet dinh #2. */
  @Column({ name: 'cost_price', type: 'bigint', default: 0, transformer: moneyTransformer })
  costPrice: number;

  /** Nguong canh bao sap het - `InventoryAlertsService` doc cot nay (P6-T8). */
  @Column({ name: 'minimum_stock', type: 'int', default: 0 })
  minimumStock: number;

  @Column({ name: 'active', default: true })
  active: boolean;
}
