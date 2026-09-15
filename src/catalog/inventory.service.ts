import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Branch, InventoryItem, Item } from '@/database/entities';
import { PaginatedResultDto } from '@/common/dto/paginated-result.dto';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';

const SORTABLE_COLUMNS = new Set(['inventoryQuantity', 'createdAt', 'updatedAt']);
/** Postgres unique_violation error code. */
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem) private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(Item) private readonly itemsRepository: Repository<Item>,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
  ) {}

  async findAll(query: QueryInventoryDto): Promise<PaginatedResultDto<InventoryItem>> {
    const qb = this.inventoryRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.item', 'item');

    if (query.branchId) {
      qb.andWhere('inventory.branchId = :branchId', { branchId: query.branchId });
    }

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`inventory.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  /**
   * Upsert on the entity's unique `(item, branch)` index: re-stocking the same item at
   * the same branch is the common case, so a POST for a pair that already has a row ADDS
   * `inventoryQuantity` to the existing stock (rather than erroring or overwriting) and
   * reactivates the row if it had been marked inactive. A concurrent insert racing this
   * check is caught via the unique-violation error and retried as an update.
   */
  async create(dto: CreateInventoryDto): Promise<InventoryItem> {
    const item = await this.itemsRepository.findOne({ where: { id: dto.itemId } });
    if (!item) {
      throw new BadRequestException('Item not found');
    }

    const branch = await this.branchesRepository.findOne({ where: { id: dto.branchId } });
    if (!branch) {
      throw new BadRequestException('Branch not found');
    }

    const existing = await this.inventoryRepository.findOne({
      where: { itemId: dto.itemId, branchId: dto.branchId },
    });
    if (existing) {
      return this.addStock(existing, dto.inventoryQuantity);
    }

    try {
      const created = this.inventoryRepository.create({
        itemId: dto.itemId,
        branchId: dto.branchId,
        inventoryQuantity: dto.inventoryQuantity,
        active: true,
      });
      return await this.inventoryRepository.save(created);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        // Lost the race to a concurrent restock request for the same (item, branch) pair.
        const race = await this.inventoryRepository.findOneOrFail({
          where: { itemId: dto.itemId, branchId: dto.branchId },
        });
        return this.addStock(race, dto.inventoryQuantity);
      }
      throw err;
    }
  }

  /**
   * `inventoryQuantity` sets the absolute stock level; `delta` adds/subtracts from the
   * current level. Providing both is rejected. See UpdateInventoryDto for the full
   * semantics.
   */
  async update(id: string, dto: UpdateInventoryDto): Promise<InventoryItem> {
    const inventoryItem = await this.inventoryRepository.findOne({ where: { id } });
    if (!inventoryItem) {
      throw new NotFoundException('Inventory record not found');
    }

    if (dto.inventoryQuantity !== undefined && dto.delta !== undefined) {
      throw new BadRequestException('Provide either inventoryQuantity or delta, not both');
    }

    if (dto.inventoryQuantity !== undefined) {
      inventoryItem.inventoryQuantity = dto.inventoryQuantity;
    } else if (dto.delta !== undefined) {
      const next = inventoryItem.inventoryQuantity + dto.delta;
      if (next < 0) {
        throw new BadRequestException('Resulting inventory quantity cannot be negative');
      }
      inventoryItem.inventoryQuantity = next;
    }

    if (dto.active !== undefined) {
      inventoryItem.active = dto.active;
    }

    return this.inventoryRepository.save(inventoryItem);
  }

  private addStock(inventoryItem: InventoryItem, quantity: number): Promise<InventoryItem> {
    inventoryItem.inventoryQuantity += quantity;
    inventoryItem.active = true;
    return this.inventoryRepository.save(inventoryItem);
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as unknown as { driverError?: { code?: string } }).driverError?.code === UNIQUE_VIOLATION
    );
  }
}
