import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InventoryBatch } from '@/modules/catalog/domain/entities/inventory-batch.entity';
import { InventoryItem } from '@/modules/catalog/domain/entities/inventory-item.entity';
import { InventoryTransaction } from '@/modules/catalog/domain/entities/inventory-transaction.entity';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import {
  InventoryReferenceType,
  InventoryTransactionType,
} from '@/shared/common/enums/inventory-transaction-type.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import {
  AllocatableBatch,
  BatchAllocation,
  InsufficientStockError,
  allocateFefo,
  availableQuantity,
  isValidSign,
  planLedgerLines,
  toDateOnly,
} from '@/modules/catalog/domain/inventory-allocation.util';
import { CreateInventoryDto } from '@/modules/catalog/presentation/dto/create-inventory.dto';
import { UpdateInventoryDto } from '@/modules/catalog/presentation/dto/update-inventory.dto';
import { QueryInventoryDto } from '@/modules/catalog/presentation/dto/query-inventory.dto';
import { QueryInventoryTransactionsDto } from '@/modules/catalog/presentation/dto/query-inventory-transactions.dto';

const SORTABLE_COLUMNS = new Set(['inventoryQuantity', 'createdAt', 'updatedAt']);
const TRANSACTION_SORTABLE_COLUMNS = new Set(['createdAt', 'quantityChange']);

/** Ma lo mac dinh khi kiem ke phat hien THUA ma khong biet so thua thuoc lo nao. */
const ADJUSTMENT_BATCH_PREFIX = 'KK';

export interface ReceiveStockParams {
  itemId: string;
  branchId: string;
  batchNo: string;
  expiryDate?: string | null;
  quantity: number;
  costPrice?: number;
  supplierId?: string | null;
  goodsReceiptId?: string | null;
  /** Mac dinh `PURCHASE`. Chi `PURCHASE` va `RETURN` hop le o day. */
  type?: InventoryTransactionType;
  referenceType?: InventoryReferenceType;
  referenceId?: string | null;
  performedByUserId?: string | null;
  note?: string | null;
}

export interface IssueStockParams {
  itemId: string;
  branchId: string;
  quantity: number;
  /** Phai la mot loai lam GIAM ton - xem `ISSUE_TRANSACTION_TYPES`. */
  type: InventoryTransactionType;
  referenceType?: InventoryReferenceType;
  referenceId?: string | null;
  performedByUserId?: string | null;
  note?: string | null;
}

export interface AdjustStockParams {
  itemId: string;
  branchId: string;
  /** Am hoac duong, khac 0. */
  quantityChange: number;
  /** Lo cu the. Bo trong thi xem comment cua `resolveAdjustmentBatch`. */
  batchId?: string | null;
  /** BAT BUOC ve nghiep vu: mot dieu chinh khong ly do la mot lo hong khong truy duoc. */
  note: string;
  referenceType?: InventoryReferenceType;
  referenceId?: string | null;
  performedByUserId?: string | null;
}

/**
 * =====================================================================================
 * LUAT SO MOT CUA KHO: MOI THAY DOI TON KHO PHAI DI QUA SERVICE NAY.
 *
 * Khong module nao, khong migration nao, khong script nao duoc `UPDATE inventory_items`
 * hay `UPDATE inventory_batches` truc tiep. Ly do la quyet dinh (B) o `phase-06`:
 * `inventory_items.inventory_quantity` la BAN CACHE cua `SUM(batches.quantity)`, va no
 * chi dung khi hai bang duoc ghi trong CUNG mot transaction, kem mot dong so cai. Mot
 * cho ghi tat thoi la ton kho lech am tham - POS va cap phat thuoc se dua tren so sai
 * ma khong ai biet cho toi ky kiem ke.
 *
 * Ba bao dam cua service nay:
 *   1. Transaction + `pg_advisory_xact_lock` theo cap `(itemId, branchId)` - hai lenh
 *      xuat song song tren cung mot mat hang khong bao gio ra ton am (cung mau voi
 *      `BillingService.generateForAppointment`).
 *   2. Moi thay doi sinh dung mot dong `InventoryTransaction` cho moi lo bi cham toi.
 *   3. `SUM(quantity_change) = inventory_quantity` - bat bien nay duoc test khang dinh
 *      o `domain/inventory-allocation.spec.ts` va la cai giup P10 bao cao kho tin cay.
 *
 * MOI ham nghiep vu deu nhan `manager` tuy chon: P6-T5 (nhan hang) va P8 (POS) phai goi
 * nhieu lan trong CUNG mot transaction cua ho. Truyen `manager` vao thi lenh chay chung
 * transaction; bo trong thi service tu mo transaction rieng.
 * =====================================================================================
 */
@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryBatch)
    private readonly batchesRepository: Repository<InventoryBatch>,
    @InjectRepository(InventoryTransaction)
    private readonly transactionsRepository: Repository<InventoryTransaction>,
    @InjectRepository(Item) private readonly itemsRepository: Repository<Item>,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------- Nghiep vu

  /**
   * Nhap hang vao kho - BR-13.
   *
   * Nhap lai dung ma lo da co thi CONG DON vao lo do chu khong tao lo thu hai (rang
   * buoc unique `(inventory_item_id, batch_no)` cung chan viec do o CSDL). Khi ay
   * `costPrice` duoc tinh BINH QUAN GIA QUYEN theo so luong: neu khong, gia von cua
   * phan hang nhap dot sau se bien mat va bao cao loi nhuan se lech.
   *
   * Han dung phai khop: cung ma lo ma khac han la dau hieu nhap sai ma lo, khong phai
   * mot tinh huong hop le - tra 409 de nguoi nhap kiem tra lai vo hop.
   */
  async receive(params: ReceiveStockParams, manager?: EntityManager): Promise<InventoryBatch> {
    return this.run(manager, (em) => this.receiveIn(em, params));
  }

  /**
   * Xuat kho theo FEFO - BR-11.
   *
   * Khong nhan `batchId`: NGUOI GOI khong duoc chon lo. Chon lo la quyet dinh cua kho
   * (het han som nhat truoc), va cho POS chon lo nghia la som muon se co lo nam lai
   * toi luc phai huy.
   *
   * @throws {ConflictException} khi khong du hang - va khi do KHONG co gi bi thay doi.
   */
  async issue(params: IssueStockParams, manager?: EntityManager): Promise<BatchAllocation[]> {
    return this.run(manager, (em) => this.issueIn(em, params));
  }

  /** Dieu chinh ton (kiem ke, hang hong, that lac). Loai giao dich luon la `ADJUSTMENT`. */
  async adjust(params: AdjustStockParams, manager?: EntityManager): Promise<InventoryItem> {
    return this.run(manager, (em) => this.adjustIn(em, params));
  }

  /**
   * So THUC SU dung duoc - da loai lo het han (BR-11).
   *
   * Khac `inventoryItem.inventoryQuantity`: so tong con tinh ca hang het han (no van
   * nam trong kho, van phai huy va van phai bao cao), con so nay la cai POS va man
   * hinh cap thuoc duoc phep ban.
   */
  async getAvailable(itemId: string, branchId: string, manager?: EntityManager): Promise<number> {
    const em = manager ?? this.dataSource.manager;
    const inventoryItem = await em.findOne(InventoryItem, { where: { itemId, branchId } });
    if (!inventoryItem) {
      return 0;
    }
    const batches = await this.loadBatches(em, inventoryItem.id);
    return availableQuantity(batches, toDateOnly(new Date()));
  }

  // ------------------------------------------------------------------------- Doc

  async findAll(query: QueryInventoryDto): Promise<PaginatedResultDto<InventoryItem>> {
    const qb = this.inventoryRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.item', 'item');

    if (query.branchId) {
      qb.andWhere('inventory.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.itemId) {
      qb.andWhere('inventory.itemId = :itemId', { itemId: query.itemId });
    }
    if (query.search) {
      qb.andWhere('(item.itemName ILIKE :search OR item.code ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.lowStock) {
      // "Sap het" doc nguong tu ho so san pham/thuoc/vaccine cua chinh item do. LEFT JOIN
      // ca ba vi mot item chi la mot trong ba - COALESCE lay cai nao co.
      qb.leftJoin('products', 'product', 'product.item_id = item.id AND product.deleted_at IS NULL')
        .leftJoin(
          'medications',
          'medication',
          'medication.item_id = item.id AND medication.deleted_at IS NULL',
        )
        .leftJoin('vaccines', 'vaccine', 'vaccine.item_id = item.id AND vaccine.deleted_at IS NULL')
        .andWhere(
          'inventory.inventoryQuantity <= COALESCE(product.minimum_stock, medication.minimum_stock, vaccine.minimum_stock, 0)',
        );
    }

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`inventory.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  /** Cac lo cua mot dong ton kho, sap theo han dung - man hinh kho hien theo thu tu nay. */
  async findBatchesOf(inventoryItemId: string): Promise<InventoryBatch[]> {
    const inventoryItem = await this.inventoryRepository.findOne({
      where: { id: inventoryItemId },
    });
    if (!inventoryItem) {
      throw new NotFoundException('Inventory record not found');
    }
    return this.batchesRepository.find({
      where: { inventoryItemId },
      order: { expiryDate: { direction: 'ASC', nulls: 'LAST' }, receivedAt: 'ASC' },
    });
  }

  /** So cai - loc theo item / loai / chi nhanh / khoang ngay, co phan trang (P6-T8). */
  async findTransactions(
    query: QueryInventoryTransactionsDto,
  ): Promise<PaginatedResultDto<InventoryTransaction>> {
    const qb = this.transactionsRepository
      .createQueryBuilder('trx')
      .leftJoinAndSelect('trx.inventoryItem', 'inventory')
      .leftJoinAndSelect('inventory.item', 'item')
      .leftJoinAndSelect('trx.batch', 'batch');

    if (query.branchId) {
      qb.andWhere('trx.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.inventoryItemId) {
      qb.andWhere('trx.inventoryItemId = :inventoryItemId', {
        inventoryItemId: query.inventoryItemId,
      });
    }
    if (query.itemId) {
      qb.andWhere('inventory.itemId = :itemId', { itemId: query.itemId });
    }
    if (query.type) {
      qb.andWhere('trx.type = :type', { type: query.type });
    }
    if (query.fromDate) {
      qb.andWhere('trx.createdAt >= :fromDate', {
        fromDate: new Date(`${query.fromDate}T00:00:00`),
      });
    }
    if (query.toDate) {
      qb.andWhere('trx.createdAt <= :toDate', { toDate: new Date(`${query.toDate}T23:59:59.999`) });
    }

    const sortBy =
      query.sortBy && TRANSACTION_SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`trx.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  // ------------------------------------------------------- CRUD cua man hinh kho

  /**
   * Khai bao mot mat hang co mat o mot chi nhanh.
   *
   * Truoc P6 endpoint nay ghi thang so ton. Gio no chi tao DONG ton kho; neu co
   * `inventoryQuantity > 0` thi phan do di qua `adjust` de van sinh dong so cai - bat
   * bien SUM(quantity_change) = inventory_quantity khong duoc phep co ngoai le nao.
   */
  async create(dto: CreateInventoryDto, performedByUserId?: string): Promise<InventoryItem> {
    const item = await this.itemsRepository.findOne({ where: { id: dto.itemId } });
    if (!item) {
      throw new BadRequestException('Item not found');
    }
    const branch = await this.branchesRepository.findOne({ where: { id: dto.branchId } });
    if (!branch) {
      throw new BadRequestException('Branch not found');
    }

    return this.dataSource.transaction(async (em) => {
      await this.lock(em, dto.itemId, dto.branchId);
      const inventoryItem = await this.ensureInventoryItem(em, dto.itemId, dto.branchId);

      if (dto.inventoryQuantity > 0) {
        return this.adjustIn(em, {
          itemId: dto.itemId,
          branchId: dto.branchId,
          quantityChange: dto.inventoryQuantity,
          note: 'Khai bao ton ban dau',
          performedByUserId,
        });
      }
      return inventoryItem;
    });
  }

  /**
   * Sua mot dong ton kho tu man hinh kho.
   *
   * `inventoryQuantity` (dat so tuyet doi) va `delta` deu duoc quy ve mot lenh `adjust`
   * co sinh so cai - khong con duong ghi thang nao nua. `active` khong dung toi ton nen
   * ghi truc tiep.
   */
  async update(
    id: string,
    dto: UpdateInventoryDto,
    performedByUserId?: string,
  ): Promise<InventoryItem> {
    if (dto.inventoryQuantity !== undefined && dto.delta !== undefined) {
      throw new BadRequestException('Provide either inventoryQuantity or delta, not both');
    }

    const existing = await this.inventoryRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Inventory record not found');
    }

    return this.dataSource.transaction(async (em) => {
      await this.lock(em, existing.itemId, existing.branchId);
      const inventoryItem = await em.findOneOrFail(InventoryItem, { where: { id } });

      if (dto.active !== undefined) {
        inventoryItem.active = dto.active;
        await em.save(inventoryItem);
      }

      const change =
        dto.inventoryQuantity !== undefined
          ? dto.inventoryQuantity - inventoryItem.inventoryQuantity
          : (dto.delta ?? 0);

      if (change === 0) {
        return inventoryItem;
      }
      return this.adjustIn(em, {
        itemId: inventoryItem.itemId,
        branchId: inventoryItem.branchId,
        quantityChange: change,
        note: dto.note ?? 'Dieu chinh tu man hinh kho',
        performedByUserId,
      });
    });
  }

  // ------------------------------------------------------------------ Ben trong

  private async receiveIn(em: EntityManager, params: ReceiveStockParams): Promise<InventoryBatch> {
    const type = params.type ?? InventoryTransactionType.PURCHASE;
    if (params.quantity <= 0 || !Number.isInteger(params.quantity)) {
      throw new BadRequestException('So luong nhap phai la so nguyen duong');
    }
    if (!isValidSign(type, params.quantity)) {
      throw new BadRequestException(`Loai giao dich ${type} khong dung de nhap kho`);
    }

    await this.lock(em, params.itemId, params.branchId);
    const inventoryItem = await this.ensureInventoryItem(em, params.itemId, params.branchId);

    const expiryDate = params.expiryDate ?? null;
    let batch = await em.findOne(InventoryBatch, {
      where: { inventoryItemId: inventoryItem.id, batchNo: params.batchNo },
    });

    if (batch) {
      if (batch.expiryDate !== expiryDate) {
        throw new ConflictException(
          `Ma lo "${params.batchNo}" da ton tai voi han dung khac (${batch.expiryDate ?? 'khong han'}). ` +
            'Kiem tra lai ma lo tren vo hop.',
        );
      }
      batch.costPrice = this.weightedCost(
        batch.quantity,
        batch.costPrice,
        params.quantity,
        params.costPrice ?? batch.costPrice,
      );
      batch.quantity += params.quantity;
      if (params.supplierId) batch.supplierId = params.supplierId;
      if (params.goodsReceiptId) batch.goodsReceiptId = params.goodsReceiptId;
    } else {
      batch = em.create(InventoryBatch, {
        inventoryItemId: inventoryItem.id,
        batchNo: params.batchNo,
        expiryDate,
        quantity: params.quantity,
        costPrice: params.costPrice ?? 0,
        receivedAt: new Date(),
        supplierId: params.supplierId ?? null,
        goodsReceiptId: params.goodsReceiptId ?? null,
      });
    }
    batch = await em.save(batch);

    const [line] = planLedgerLines(inventoryItem.inventoryQuantity, [
      { batchId: batch.id, quantityChange: params.quantity },
    ]);
    await this.writeLedger(em, inventoryItem, [line], {
      type,
      referenceType: params.referenceType ?? InventoryReferenceType.MANUAL,
      referenceId: params.referenceId ?? null,
      performedByUserId: params.performedByUserId ?? null,
      note: params.note ?? null,
    });

    return batch;
  }

  private async issueIn(em: EntityManager, params: IssueStockParams): Promise<BatchAllocation[]> {
    if (params.quantity <= 0 || !Number.isInteger(params.quantity)) {
      throw new BadRequestException('So luong xuat phai la so nguyen duong');
    }
    if (!isValidSign(params.type, -params.quantity)) {
      throw new BadRequestException(`Loai giao dich ${params.type} khong dung de xuat kho`);
    }

    await this.lock(em, params.itemId, params.branchId);
    const inventoryItem = await em.findOne(InventoryItem, {
      where: { itemId: params.itemId, branchId: params.branchId },
    });
    if (!inventoryItem) {
      // Chua khai bao ton o chi nhanh nay = khong co hang. Cung ket qua 409 voi
      // truong hop co dong nhung ton 0, de nguoi goi chi phai xu ly mot loai loi.
      throw new ConflictException('Khong du ton kho: kha dung 0');
    }

    const batches = await this.loadBatches(em, inventoryItem.id);
    let allocations: BatchAllocation[];
    try {
      allocations = allocateFefo(batches, params.quantity, toDateOnly(new Date()));
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        throw new ConflictException(err.message);
      }
      throw err;
    }

    const lines = planLedgerLines(
      inventoryItem.inventoryQuantity,
      allocations.map((allocation) => ({
        batchId: allocation.batchId,
        quantityChange: -allocation.quantity,
      })),
    );

    for (const allocation of allocations) {
      await em.decrement(
        InventoryBatch,
        { id: allocation.batchId },
        'quantity',
        allocation.quantity,
      );
    }
    await this.writeLedger(em, inventoryItem, lines, {
      type: params.type,
      referenceType: params.referenceType ?? InventoryReferenceType.MANUAL,
      referenceId: params.referenceId ?? null,
      performedByUserId: params.performedByUserId ?? null,
      note: params.note ?? null,
    });

    return allocations;
  }

  private async adjustIn(em: EntityManager, params: AdjustStockParams): Promise<InventoryItem> {
    if (!Number.isInteger(params.quantityChange) || params.quantityChange === 0) {
      throw new BadRequestException('Chenh lech kiem ke phai la so nguyen khac 0');
    }

    await this.lock(em, params.itemId, params.branchId);
    const inventoryItem = await this.ensureInventoryItem(em, params.itemId, params.branchId);

    const changes =
      params.quantityChange > 0
        ? [
            {
              batchId: (await this.resolveAdjustmentBatch(em, inventoryItem, params)).id,
              quantityChange: params.quantityChange,
            },
          ]
        : await this.planShortageAcrossBatches(em, inventoryItem, params);

    for (const change of changes) {
      if (change.quantityChange > 0) {
        await em.increment(
          InventoryBatch,
          { id: change.batchId },
          'quantity',
          change.quantityChange,
        );
      } else {
        await em.decrement(
          InventoryBatch,
          { id: change.batchId },
          'quantity',
          -change.quantityChange,
        );
      }
    }

    const lines = planLedgerLines(inventoryItem.inventoryQuantity, changes);
    return this.writeLedger(em, inventoryItem, lines, {
      type: InventoryTransactionType.ADJUSTMENT,
      referenceType: params.referenceType ?? InventoryReferenceType.MANUAL,
      referenceId: params.referenceId ?? null,
      performedByUserId: params.performedByUserId ?? null,
      note: params.note,
    });
  }

  /**
   * Kiem ke phat hien THUA thi so thua do thuoc lo nao?
   *
   * Neu nguoi kiem ke chi ro lo thi dung lo do. Neu khong (truong hop thuong gap - dem
   * ra thua ba hop ma khong biet tu dau), don vao mot lo ky thuat `KK-<ngay>`: khong
   * han dung, gia von 0. Khong tao lo ky thuat thi `SUM(batches.quantity)` se lech khoi
   * `inventory_quantity` va toan bo quyet dinh (B) sup do.
   */
  private async resolveAdjustmentBatch(
    em: EntityManager,
    inventoryItem: InventoryItem,
    params: AdjustStockParams,
  ): Promise<InventoryBatch> {
    if (params.batchId) {
      const batch = await em.findOne(InventoryBatch, {
        where: { id: params.batchId, inventoryItemId: inventoryItem.id },
      });
      if (!batch) {
        throw new BadRequestException('Lo hang khong thuoc dong ton kho nay');
      }
      return batch;
    }

    const batchNo = `${ADJUSTMENT_BATCH_PREFIX}-${toDateOnly(new Date()).replace(/-/g, '')}`;
    const existing = await em.findOne(InventoryBatch, {
      where: { inventoryItemId: inventoryItem.id, batchNo },
    });
    if (existing) {
      return existing;
    }
    return em.save(
      em.create(InventoryBatch, {
        inventoryItemId: inventoryItem.id,
        batchNo,
        expiryDate: null,
        quantity: 0,
        costPrice: 0,
        receivedAt: new Date(),
      }),
    );
  }

  /**
   * Kiem ke phat hien THIEU thi tru vao lo nao?
   *
   * Tru theo FEFO nhung KHONG loai lo het han - khac han `issue`. Ly do: dang doi soat
   * so thuc te, ma hang thieu hoan toan co the la hang het han da bi vut di. Loai lo het
   * han ra thi co truong hop khong tru du va lenh kiem ke se that bai vo co.
   */
  private async planShortageAcrossBatches(
    em: EntityManager,
    inventoryItem: InventoryItem,
    params: AdjustStockParams,
  ): Promise<{ batchId: string; quantityChange: number }[]> {
    const shortage = -params.quantityChange;

    if (params.batchId) {
      const batch = await em.findOne(InventoryBatch, {
        where: { id: params.batchId, inventoryItemId: inventoryItem.id },
      });
      if (!batch) {
        throw new BadRequestException('Lo hang khong thuoc dong ton kho nay');
      }
      if (batch.quantity < shortage) {
        throw new ConflictException(
          `Lo ${batch.batchNo} chi con ${batch.quantity}, khong the giam ${shortage}`,
        );
      }
      return [{ batchId: batch.id, quantityChange: params.quantityChange }];
    }

    const batches = await this.loadBatches(em, inventoryItem.id);
    // Ngay "hom nay" gia dinh la 1970 de khong lo nao bi coi la het han - xem comment ham.
    const allocations = (() => {
      try {
        return allocateFefo(batches, shortage, '1970-01-01');
      } catch (err) {
        if (err instanceof InsufficientStockError) {
          throw new ConflictException(err.message);
        }
        throw err;
      }
    })();

    return allocations.map((allocation) => ({
      batchId: allocation.batchId,
      quantityChange: -allocation.quantity,
    }));
  }

  /**
   * Ghi cac dong so cai va cap nhat so tong - hai viec nay LUON di cung nhau.
   *
   * `quantityAfter` cua dong cuoi chinh la so tong moi; lay tu `planLedgerLines` chu
   * khong tinh lai o day, de chi co dung mot cho tinh ton luy ke.
   */
  private async writeLedger(
    em: EntityManager,
    inventoryItem: InventoryItem,
    lines: { batchId: string | null; quantityChange: number; quantityAfter: number }[],
    meta: {
      type: InventoryTransactionType;
      referenceType: InventoryReferenceType;
      referenceId: string | null;
      performedByUserId: string | null;
      note: string | null;
    },
  ): Promise<InventoryItem> {
    if (lines.length === 0) {
      return inventoryItem;
    }

    await em.insert(
      InventoryTransaction,
      lines.map((line) => ({
        inventoryItemId: inventoryItem.id,
        batchId: line.batchId,
        branchId: inventoryItem.branchId,
        type: meta.type,
        quantityChange: line.quantityChange,
        quantityAfter: line.quantityAfter,
        referenceType: meta.referenceType,
        referenceId: meta.referenceId,
        performedByUserId: meta.performedByUserId,
        note: meta.note,
      })),
    );

    inventoryItem.inventoryQuantity = lines[lines.length - 1].quantityAfter;
    return em.save(inventoryItem);
  }

  /**
   * Tao dong ton kho neu chi nhanh chua co mat hang nay.
   *
   * `INSERT ... ON CONFLICT DO NOTHING` roi doc lai, thay vi kiem-roi-ghi: advisory lock
   * o tren da noi tiep hoa cac lenh cua CUNG cap (item, branch), nhung mot dong
   * `inventory_items` co the duoc tao boi duong khac (endpoint khai bao ton) khong di
   * qua khoa do.
   */
  private async ensureInventoryItem(
    em: EntityManager,
    itemId: string,
    branchId: string,
  ): Promise<InventoryItem> {
    await em
      .createQueryBuilder()
      .insert()
      .into(InventoryItem)
      .values({ itemId, branchId, inventoryQuantity: 0, active: true })
      .orIgnore()
      .execute();

    return em.findOneOrFail(InventoryItem, { where: { itemId, branchId } });
  }

  private async loadBatches(
    em: EntityManager,
    inventoryItemId: string,
  ): Promise<AllocatableBatch[]> {
    const batches = await em.find(InventoryBatch, {
      where: { inventoryItemId },
      select: ['id', 'batchNo', 'expiryDate', 'quantity', 'receivedAt'],
    });
    return batches.filter((batch) => batch.quantity > 0);
  }

  /**
   * Khoa theo cap `(itemId, branchId)` trong pham vi transaction.
   *
   * `hashtext` cua mot chuoi ghep chu khong phai `pg_advisory_xact_lock(a, b)` hai tham
   * so: hai tham so kia la int4, ma id o day la uuid. Va chan tren mot chuoi ghep thi
   * hai chi nhanh khac nhau cua cung mot mat hang khong chan nhau.
   */
  private lock(em: EntityManager, itemId: string, branchId: string): Promise<unknown> {
    return em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`inv:${itemId}:${branchId}`]);
  }

  /** Chay trong transaction cua nguoi goi neu co, khong thi tu mo mot cai. */
  private run<T>(
    manager: EntityManager | undefined,
    work: (em: EntityManager) => Promise<T>,
  ): Promise<T> {
    return manager ? work(manager) : this.dataSource.transaction(work);
  }

  /** Binh quan gia quyen theo so luong, lam tron xuong ve dong nguyen. */
  private weightedCost(
    currentQuantity: number,
    currentCost: number,
    incomingQuantity: number,
    incomingCost: number,
  ): number {
    const total = currentQuantity + incomingQuantity;
    if (total <= 0) {
      return incomingCost;
    }
    return Math.round((currentQuantity * currentCost + incomingQuantity * incomingCost) / total);
  }
}
