import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { QueryItemsDto } from '@/modules/catalog/presentation/dto/query-items.dto';

const SORTABLE_COLUMNS = new Set(['itemName', 'unitPrice', 'itemType', 'createdAt', 'updatedAt']);

/**
 * Generic read side of the shared `Item` catalog - the public price-list endpoint
 * (`GET /catalog/items`) and the read other backend modules use when they need current
 * prices without caring whether a row is a Service, Medication, lab test, etc.
 */
@Injectable()
export class ItemsService {
  constructor(@InjectRepository(Item) private readonly itemsRepository: Repository<Item>) {}

  async findAll(query: QueryItemsDto): Promise<PaginatedResultDto<Item>> {
    const qb = this.itemsRepository.createQueryBuilder('item');

    if (query.itemType) {
      qb.andWhere('item.itemType = :itemType', { itemType: query.itemType });
    }
    qb.andWhere('item.active = :active', { active: query.active ?? true });

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'itemName';
    qb.orderBy(`item.${sortBy}`, query.sortOrder ?? 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Item> {
    const item = await this.itemsRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    return item;
  }
}
