import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { Medication } from '@/modules/catalog/domain/entities/medication.entity';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { CreateMedicationDto } from '@/modules/catalog/presentation/dto/create-medication.dto';
import { UpdateMedicationDto } from '@/modules/catalog/presentation/dto/update-medication.dto';
import { QueryCatalogEntryDto } from '@/modules/catalog/presentation/dto/query-catalog-entry.dto';

const ITEM_SORT_COLUMNS = new Set(['itemName', 'unitPrice']);
const MEDICATION_SORT_COLUMNS = new Set(['unit', 'createdAt', 'updatedAt']);

/**
 * This is the catalog the examinations module (built in parallel by another agent)
 * references by `medicationId` when a doctor prescribes.
 */
@Injectable()
export class MedicationsService {
  constructor(
    @InjectRepository(Medication) private readonly medicationsRepository: Repository<Medication>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Creates the backing Item (itemType=MEDICATION) and the Medication row in one transaction. */
  async create(dto: CreateMedicationDto): Promise<Medication> {
    const medicationId = await this.dataSource.transaction(async (manager) => {
      const item = await manager.save(
        manager.create(Item, {
          itemName: dto.itemName,
          describe: dto.describe ?? null,
          itemType: ItemType.MEDICATION,
          unitPrice: dto.unitPrice,
          active: true,
        }),
      );

      const medication = await manager.save(
        manager.create(Medication, {
          itemId: item.id,
          unit: dto.unit,
          activeIngredient: dto.activeIngredient ?? null,
          active: true,
        }),
      );

      return medication.id;
    });

    return this.findOne(medicationId);
  }

  async findAll(query: QueryCatalogEntryDto): Promise<PaginatedResultDto<Medication>> {
    const qb = this.medicationsRepository
      .createQueryBuilder('medication')
      .leftJoinAndSelect('medication.item', 'item');

    qb.andWhere('medication.active = :active', { active: query.active ?? true });

    const requestedSort = query.sortBy;
    const sortColumn = ITEM_SORT_COLUMNS.has(requestedSort ?? '')
      ? `item.${requestedSort}`
      : MEDICATION_SORT_COLUMNS.has(requestedSort ?? '')
        ? `medication.${requestedSort}`
        : 'item.itemName';

    qb.orderBy(sortColumn, query.sortOrder ?? 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Medication> {
    const medication = await this.medicationsRepository.findOne({
      where: { id },
      relations: ['item'],
    });
    if (!medication) {
      throw new NotFoundException('Medication not found');
    }
    return medication;
  }

  /**
   * Updates the Item-owned fields (itemName/describe/unitPrice) and/or the
   * Medication-owned fields (unit/activeIngredient) in one transaction. `active` is
   * mirrored onto both rows - see UpdateMedicationDto for why.
   */
  async update(id: string, dto: UpdateMedicationDto): Promise<Medication> {
    const medication = await this.findOne(id);

    await this.dataSource.transaction(async (manager) => {
      // Pick (not Partial<Item>/Partial<Medication>) deliberately excludes relation
      // properties from the update object's type - see services.service.ts's
      // `update()` for why a `Partial<Entity>`-typed variable doesn't structurally
      // match TypeORM's QueryDeepPartialEntity even when relation keys are never set.
      const itemUpdates: Partial<Pick<Item, 'itemName' | 'describe' | 'unitPrice' | 'active'>> = {};
      if (dto.itemName !== undefined) itemUpdates.itemName = dto.itemName;
      if (dto.describe !== undefined) itemUpdates.describe = dto.describe;
      if (dto.unitPrice !== undefined) itemUpdates.unitPrice = dto.unitPrice;
      if (dto.active !== undefined) itemUpdates.active = dto.active;
      if (Object.keys(itemUpdates).length > 0) {
        await manager.update(Item, medication.itemId, itemUpdates);
      }

      const medicationUpdates: Partial<Pick<Medication, 'unit' | 'activeIngredient' | 'active'>> =
        {};
      if (dto.unit !== undefined) medicationUpdates.unit = dto.unit;
      if (dto.activeIngredient !== undefined)
        medicationUpdates.activeIngredient = dto.activeIngredient;
      if (dto.active !== undefined) medicationUpdates.active = dto.active;
      if (Object.keys(medicationUpdates).length > 0) {
        await manager.update(Medication, id, medicationUpdates);
      }
    });

    return this.findOne(id);
  }
}
