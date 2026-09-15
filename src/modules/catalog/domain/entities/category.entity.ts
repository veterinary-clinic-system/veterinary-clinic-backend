import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { ItemType } from '@/shared/common/enums/item-type.enum';

@Entity({ name: 'categories' })
@Index(['itemType', 'parentId'])
export class Category extends BaseEntity {
  @Column({ name: 'category_name', length: 255 })
  categoryName: string;

  @Column({ name: 'code', length: 64 })
  code: string;

  @ManyToOne(() => Category, (category) => category.children, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_id' })
  parent: Category | null;

  @Column({ name: 'parent_id', type: 'varchar', nullable: true })
  parentId: string | null;

  @OneToMany(() => Category, (category) => category.parent)
  children?: Category[];

  @Column({ name: 'item_type', type: 'enum', enum: ItemType })
  itemType: ItemType;

  @Column({ name: 'active', default: true })
  active: boolean;
}
