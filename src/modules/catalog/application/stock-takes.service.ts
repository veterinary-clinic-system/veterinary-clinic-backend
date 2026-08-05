import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { InventoryItem } from '@/modules/catalog/domain/entities/inventory-item.entity';
import { StockTakeItem } from '@/modules/catalog/domain/entities/stock-take-item.entity';
import { StockTake } from '@/modules/catalog/domain/entities/stock-take.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { InventoryReferenceType } from '@/shared/common/enums/inventory-transaction-type.enum';
import { StockTakeStatus } from '@/shared/common/enums/stock-take-status.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { toDateOnly } from '@/modules/catalog/domain/inventory-allocation.util';
import { InventoryService } from '@/modules/catalog/application/inventory.service';
import {
  ConfirmStockTakeDto,
  CreateStockTakeDto,
  SubmitStockTakeCountsDto,
} from '@/modules/catalog/presentation/dto/create-stock-take.dto';
import { QueryStockTakesDto } from '@/modules/catalog/presentation/dto/query-stock-takes.dto';

const SORTABLE_COLUMNS = new Set(['takenDate', 'createdAt', 'confirmedAt']);
const DETAIL_RELATIONS = ['items', 'items.item', 'branch'];

/**
 * Kiem ke - SRS FR-18-03.
 *
 * Luong: tao phieu (chup so ton hien tai) -> nhap so dem -> xac nhan.
 *
 * Service nay KHONG tu tinh ton. Xac nhan phieu goi `InventoryService.adjust` cho tung
 * dong co chenh lech, va do la duong duy nhat ton thay doi - dung luat so mot cua kho.
 */
@Injectable()
export class StockTakesService {
  constructor(
    @InjectRepository(StockTake) private readonly stockTakesRepository: Repository<StockTake>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    private readonly inventoryService: InventoryService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Tao phieu va CHUP so ton ngay tai day.
   *
   * Chup trong cung transaction voi viec tao phieu: neu chup roi moi luu o mot buoc
   * khac, mot lan ban hang xen giua se lam so chup khong ung voi bat ky thoi diem nao.
   */
  async create(dto: CreateStockTakeDto, createdByUserId?: string): Promise<StockTake> {
    const branch = await this.branchesRepository.findOne({ where: { id: dto.branchId } });
    if (!branch) {
      throw new BadRequestException('Branch not found');
    }

    const stockTakeId = await this.dataSource.transaction(async (em) => {
      const inventoryItems = await em.find(InventoryItem, {
        where: dto.inventoryItemIds?.length
          ? { branchId: dto.branchId, id: In(dto.inventoryItemIds) }
          : { branchId: dto.branchId },
      });
      if (inventoryItems.length === 0) {
        throw new BadRequestException('Chi nhanh chua co mat hang nao de kiem ke');
      }
      if (dto.inventoryItemIds?.length && inventoryItems.length !== dto.inventoryItemIds.length) {
        throw new BadRequestException('Mot hoac nhieu dong ton kho khong thuoc chi nhanh nay');
      }

      const stockTake = await em.save(
        em.create(StockTake, {
          branchId: dto.branchId,
          status: StockTakeStatus.DRAFT,
          takenDate: dto.takenDate ?? toDateOnly(new Date()),
          createdByUserId: createdByUserId ?? null,
          note: dto.note ?? null,
        }),
      );

      await em.save(
        inventoryItems.map((inventoryItem) =>
          em.create(StockTakeItem, {
            stockTakeId: stockTake.id,
            inventoryItemId: inventoryItem.id,
            itemId: inventoryItem.itemId,
            systemQuantity: inventoryItem.inventoryQuantity,
            countedQuantity: null,
          }),
        ),
      );

      return stockTake.id;
    });

    return this.findOne(stockTakeId);
  }

  async findAll(query: QueryStockTakesDto): Promise<PaginatedResultDto<StockTake>> {
    const qb = this.stockTakesRepository
      .createQueryBuilder('stockTake')
      .leftJoinAndSelect('stockTake.branch', 'branch');

    if (query.branchId) {
      qb.andWhere('stockTake.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.status) qb.andWhere('stockTake.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere('stockTake.stockTakeCode ILIKE :search', { search: `%${query.search}%` });
    }

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`stockTake.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<StockTake> {
    const stockTake = await this.stockTakesRepository.findOne({
      where: { id },
      relations: DETAIL_RELATIONS,
    });
    if (!stockTake) {
      throw new NotFoundException('Stock take not found');
    }
    return stockTake;
  }

  /** Nhap so dem cho nhieu dong. Chi lam duoc khi phieu con `DRAFT`. */
  async submitCounts(id: string, dto: SubmitStockTakeCountsDto): Promise<StockTake> {
    const stockTake = await this.findOne(id);
    this.assertDraft(stockTake);

    const lines = new Map((stockTake.items ?? []).map((line) => [line.id, line]));
    for (const count of dto.items) {
      if (!lines.has(count.stockTakeItemId)) {
        throw new BadRequestException('Dong kiem ke khong thuoc phieu nay');
      }
    }

    await this.dataSource.transaction(async (em) => {
      for (const count of dto.items) {
        await em.update(
          StockTakeItem,
          { id: count.stockTakeItemId },
          { countedQuantity: count.countedQuantity, note: count.note ?? null },
        );
      }
    });

    return this.findOne(id);
  }

  /**
   * Xac nhan phieu - dieu chinh ton cho tung dong co chenh lech.
   *
   * Ca phieu nam trong MOT transaction: xac nhan nua chung se de lai mot phieu
   * `CONFIRMED` ma chi mot phan mat hang duoc dieu chinh, va khong con cach nao biet
   * phan nao da xong.
   *
   * Dong chua dem (`countedQuantity IS NULL`) bi BO QUA, khong coi la thieu toan bo -
   * xem comment o migration `StockTakes1792000004000`.
   */
  async confirm(
    id: string,
    dto: ConfirmStockTakeDto,
    confirmedByUserId?: string,
  ): Promise<StockTake> {
    const stockTake = await this.findOne(id);
    this.assertDraft(stockTake);

    const counted = (stockTake.items ?? []).filter((line) => line.countedQuantity !== null);
    if (counted.length === 0) {
      throw new ConflictException('Chua dem dong nao - khong co gi de xac nhan');
    }

    await this.dataSource.transaction(async (em) => {
      for (const line of counted) {
        const discrepancy = line.discrepancy;
        if (discrepancy === null || discrepancy === 0) {
          continue;
        }

        const inventoryItem = await em.findOneOrFail(InventoryItem, {
          where: { id: line.inventoryItemId },
        });

        await this.inventoryService.adjust(
          {
            itemId: inventoryItem.itemId,
            branchId: inventoryItem.branchId,
            quantityChange: discrepancy,
            note:
              line.note ??
              dto.note ??
              `Kiem ke ${stockTake.stockTakeCode}: he thong ${line.systemQuantity}, dem ${line.countedQuantity}`,
            referenceType: InventoryReferenceType.STOCK_TAKE,
            referenceId: stockTake.id,
            performedByUserId: confirmedByUserId ?? null,
          },
          em,
        );
      }

      await em.update(
        StockTake,
        { id: stockTake.id },
        {
          status: StockTakeStatus.CONFIRMED,
          confirmedByUserId: confirmedByUserId ?? null,
          confirmedAt: new Date(),
          note: dto.note ?? stockTake.note,
        },
      );
    });

    return this.findOne(id);
  }

  async cancel(id: string): Promise<StockTake> {
    const stockTake = await this.findOne(id);
    this.assertDraft(stockTake);

    await this.stockTakesRepository.update({ id }, { status: StockTakeStatus.CANCELLED });
    return this.findOne(id);
  }

  /**
   * Acceptance P6-T6: phieu da xac nhan khong sua duoc.
   *
   * Cung ap dung cho phieu da huy. Ly do khac nhau nhung ket qua giong nhau: phieu
   * `CONFIRMED` da sinh cac dong so cai bat bien, sua no se lam so cai va chung tu noi
   * nhau; phieu `CANCELLED` thi khong con la chung tu nua.
   */
  private assertDraft(stockTake: StockTake): void {
    if (stockTake.status !== StockTakeStatus.DRAFT) {
      throw new ConflictException(
        `Phieu ${stockTake.stockTakeCode} da ${stockTake.status}, khong sua duoc nua`,
      );
    }
  }
}
