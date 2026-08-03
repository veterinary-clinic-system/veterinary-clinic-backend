import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { CreateServiceDto } from '@/modules/catalog/presentation/dto/create-service.dto';
import { UpdateServiceDto } from '@/modules/catalog/presentation/dto/update-service.dto';
import { QueryCatalogEntryDto } from '@/modules/catalog/presentation/dto/query-catalog-entry.dto';

const ITEM_SORT_COLUMNS = new Set(['itemName', 'unitPrice']);
const SERVICE_SORT_COLUMNS = new Set(['durationMinutes', 'createdAt', 'updatedAt']);

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service) private readonly servicesRepository: Repository<Service>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Creates the backing Item (itemType=SERVICE) and the Service row in one transaction. */
  async create(dto: CreateServiceDto): Promise<Service> {
    const serviceId = await this.dataSource.transaction(async (manager) => {
      const item = await manager.save(
        manager.create(Item, {
          itemName: dto.itemName,
          describe: dto.describe ?? null,
          itemType: ItemType.SERVICE,
          unitPrice: dto.unitPrice,
          active: true,
        }),
      );

      const service = await manager.save(
        manager.create(Service, {
          itemId: item.id,
          durationMinutes: dto.durationMinutes,
          requiresSpecialization: dto.requiresSpecialization ?? null,
          active: true,
        }),
      );

      return service.id;
    });

    return this.findOne(serviceId);
  }

  async findAll(query: QueryCatalogEntryDto): Promise<PaginatedResultDto<Service>> {
    const qb = this.servicesRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.item', 'item');

    qb.andWhere('service.active = :active', { active: query.active ?? true });

    const requestedSort = query.sortBy;
    const sortColumn = ITEM_SORT_COLUMNS.has(requestedSort ?? '')
      ? `item.${requestedSort}`
      : SERVICE_SORT_COLUMNS.has(requestedSort ?? '')
        ? `service.${requestedSort}`
        : 'item.itemName';

    qb.orderBy(sortColumn, query.sortOrder ?? 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.servicesRepository.findOne({ where: { id }, relations: ['item'] });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  /**
   * Updates the Item-owned fields (itemName/describe/unitPrice) and/or the Service-owned
   * fields (durationMinutes/requiresSpecialization) in one transaction. `active` is
   * mirrored onto both rows - see UpdateServiceDto for why.
   */
  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.findOne(id);

    await this.dataSource.transaction(async (manager) => {
      // Pick (not Partial<Item>/Partial<Service>) deliberately excludes relation
      // properties (invoiceItems, inventoryItems, item, ...) from the update object's
      // type - TypeORM's QueryDeepPartialEntity requires relation values to themselves
      // be deep-partial, so a `Partial<Entity>`-typed variable (which types relations as
      // full related entities) doesn't structurally match even when the relation keys
      // are never actually set at runtime.
      const itemUpdates: Partial<Pick<Item, 'itemName' | 'describe' | 'unitPrice' | 'active'>> = {};
      if (dto.itemName !== undefined) itemUpdates.itemName = dto.itemName;
      if (dto.describe !== undefined) itemUpdates.describe = dto.describe;
      if (dto.unitPrice !== undefined) itemUpdates.unitPrice = dto.unitPrice;
      if (dto.active !== undefined) itemUpdates.active = dto.active;
      if (Object.keys(itemUpdates).length > 0) {
        await manager.update(Item, service.itemId, itemUpdates);
      }

      const serviceUpdates: Partial<
        Pick<Service, 'durationMinutes' | 'requiresSpecialization' | 'active'>
      > = {};
      if (dto.durationMinutes !== undefined) serviceUpdates.durationMinutes = dto.durationMinutes;
      if (dto.requiresSpecialization !== undefined) {
        serviceUpdates.requiresSpecialization = dto.requiresSpecialization;
      }
      if (dto.active !== undefined) serviceUpdates.active = dto.active;
      if (Object.keys(serviceUpdates).length > 0) {
        await manager.update(Service, id, serviceUpdates);
      }
    });

    return this.findOne(id);
  }
}
