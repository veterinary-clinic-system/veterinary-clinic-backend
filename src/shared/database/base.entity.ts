import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * diagram.jpg models every entity's primary key as a plain `xxxId : string`.
 * We implement that as a UUID `id` column here so every entity gets a stable,
 * non-guessable identifier without a separate sequence per table.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /**
   * Xoa mem (Phan V.4 quyet dinh #5, phuc vu rang buoc R6 "du lieu y te khong duoc
   * xoa cung"). `@DeleteDateColumn` khien MOI truy van cua TypeORM tu dong them
   * `WHERE deleted_at IS NULL`, va `repository.softDelete()` chi dat moc thoi gian
   * thay vi DELETE that.
   *
   * Di kem o tang CSDL: cac chi muc duy nhat duoc doi thanh partial unique index
   * `... WHERE deleted_at IS NULL`, nho vay ma nghiep vu (so dien thoai, ma vach)
   * co the tai su dung sau khi ban ghi cu da bi xoa mem.
   */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
