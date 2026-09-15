import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';

@Entity({ name: 'suppliers' })
export class Supplier extends BaseEntity {
  
  @Column({ name: 'supplier_code', length: 32 })
  supplierCode: string;

  @Column({ name: 'name', length: 255 })
  name: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'contact_person', type: 'varchar', length: 255, nullable: true })
  contactPerson: string | null;

  @Column({ name: 'tax_code', type: 'varchar', length: 32, nullable: true })
  taxCode: string | null;

  @Column({ name: 'active', default: true })
  active: boolean;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;
}
