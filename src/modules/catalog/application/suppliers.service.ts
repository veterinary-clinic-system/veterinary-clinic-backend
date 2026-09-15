import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '@/modules/catalog/domain/entities/supplier.entity';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { CreateSupplierDto } from '@/modules/catalog/presentation/dto/create-supplier.dto';
import { UpdateSupplierDto } from '@/modules/catalog/presentation/dto/update-supplier.dto';
import { QuerySuppliersDto } from '@/modules/catalog/presentation/dto/query-suppliers.dto';

const SORTABLE_COLUMNS = new Set(['name', 'supplierCode', 'createdAt', 'updatedAt']);

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier) private readonly suppliersRepository: Repository<Supplier>,
  ) {}

  async create(dto: CreateSupplierDto): Promise<Supplier> {

    const supplier = this.suppliersRepository.create({
      name: dto.name,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
      contactPerson: dto.contactPerson ?? null,
      taxCode: dto.taxCode ?? null,
      note: dto.note ?? null,
      active: true,
    });
    const saved = await this.suppliersRepository.save(supplier);
    return this.findOne(saved.id);
  }

  async findAll(query: QuerySuppliersDto): Promise<PaginatedResultDto<Supplier>> {
    const qb = this.suppliersRepository.createQueryBuilder('supplier');

    if (query.search?.trim()) {
      qb.andWhere(
        `(f_unaccent(supplier.name) ILIKE f_unaccent(:search)
          OR supplier.supplier_code ILIKE :search
          OR supplier.phone ILIKE :search)`,
        { search: `%${query.search.trim()}%` },
      );
    }
    qb.andWhere('supplier.active = :active', { active: query.active ?? true });

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'name';
    qb.orderBy(`supplier.${sortBy}`, query.sortOrder ?? 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.suppliersRepository.findOne({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Không tìm thấy nhà cung cấp');
    }
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    await this.findOne(id);

    await this.suppliersRepository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.contactPerson !== undefined ? { contactPerson: dto.contactPerson } : {}),
      ...(dto.taxCode !== undefined ? { taxCode: dto.taxCode } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.suppliersRepository.softDelete(id);
  }
}
