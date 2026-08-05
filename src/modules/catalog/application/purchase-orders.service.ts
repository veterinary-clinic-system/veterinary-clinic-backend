import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { PurchaseOrderItem } from '@/modules/catalog/domain/entities/purchase-order-item.entity';
import { PurchaseOrder } from '@/modules/catalog/domain/entities/purchase-order.entity';
import { Supplier } from '@/modules/catalog/domain/entities/supplier.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import {
  CLOSED_PURCHASE_ORDER_STATUSES,
  PurchaseOrderStatus,
} from '@/shared/common/enums/purchase-order-status.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { toDateOnly } from '@/modules/catalog/domain/inventory-allocation.util';
import { CreatePurchaseOrderDto } from '@/modules/catalog/presentation/dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from '@/modules/catalog/presentation/dto/update-purchase-order.dto';
import { QueryPurchaseOrdersDto } from '@/modules/catalog/presentation/dto/query-purchase-orders.dto';

const SORTABLE_COLUMNS = new Set(['orderDate', 'expectedDate', 'totalAmount', 'createdAt']);
const DETAIL_RELATIONS = ['items', 'items.item', 'supplier', 'branch'];

/**
 * Trang thai NGUOI DUNG duoc tu dat. `PARTIALLY_RECEIVED`/`RECEIVED` khong nam trong
 * danh sach: chung duoc suy ra tu `receivedQuantity` cua cac dong (xem `syncStatus`),
 * cho dat tay thi trang thai va so lieu se noi nhau.
 */
const USER_SETTABLE_STATUSES: readonly PurchaseOrderStatus[] = [
  PurchaseOrderStatus.ORDERED,
  PurchaseOrderStatus.CANCELLED,
];

/**
 * Don dat hang - SRS UC-05.
 *
 * Service nay KHONG cham vao ton kho. Dat hang khong lam thay doi ton; chi phieu nhap
 * (`GoodsReceiptsService`, P6-T5) moi lam, va no di qua `InventoryService`.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly ordersRepository: Repository<PurchaseOrder>,
    @InjectRepository(Supplier) private readonly suppliersRepository: Repository<Supplier>,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(Item) private readonly itemsRepository: Repository<Item>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreatePurchaseOrderDto, createdByUserId?: string): Promise<PurchaseOrder> {
    await this.assertReferencesExist(dto.supplierId, dto.branchId, dto.items);

    const order = await this.dataSource.transaction(async (em) => {
      const created = em.create(PurchaseOrder, {
        supplierId: dto.supplierId,
        branchId: dto.branchId,
        status: PurchaseOrderStatus.DRAFT,
        orderDate: dto.orderDate ?? toDateOnly(new Date()),
        expectedDate: dto.expectedDate ?? null,
        totalAmount: this.totalOf(dto.items),
        createdByUserId: createdByUserId ?? null,
        note: dto.note ?? null,
        items: dto.items.map((line) =>
          em.create(PurchaseOrderItem, {
            itemId: line.itemId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            receivedQuantity: 0,
          }),
        ),
      });
      return em.save(created);
    });

    return this.findOne(order.id);
  }

  async findAll(query: QueryPurchaseOrdersDto): Promise<PaginatedResultDto<PurchaseOrder>> {
    const qb = this.ordersRepository
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .leftJoinAndSelect('po.branch', 'branch');

    if (query.branchId) qb.andWhere('po.branchId = :branchId', { branchId: query.branchId });
    if (query.supplierId) {
      qb.andWhere('po.supplierId = :supplierId', { supplierId: query.supplierId });
    }
    if (query.status) qb.andWhere('po.status = :status', { status: query.status });
    if (query.search) qb.andWhere('po.poCode ILIKE :search', { search: `%${query.search}%` });
    if (query.fromDate) qb.andWhere('po.orderDate >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate) qb.andWhere('po.orderDate <= :toDate', { toDate: query.toDate });

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`po.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<PurchaseOrder> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: DETAIL_RELATIONS,
    });
    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }
    return order;
  }

  /**
   * Sua don.
   *
   * Acceptance P6-T4: don `RECEIVED` khong sua duoc nua - va `CANCELLED` cung vay.
   * Rieng cac dong hang chi sua duoc khi don con `DRAFT`: don da gui nha cung cap ma
   * doi so luong thi ban cua ta va ban ho dang cam se khac nhau.
   */
  async update(id: string, dto: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
    const order = await this.findOne(id);
    this.assertOpen(order);

    if (dto.status !== undefined && !USER_SETTABLE_STATUSES.includes(dto.status)) {
      throw new BadRequestException(
        `Trang thai ${dto.status} do he thong tinh tu so da nhan, khong dat tay duoc`,
      );
    }
    if (dto.items && order.status !== PurchaseOrderStatus.DRAFT) {
      throw new ConflictException('Chi sua duoc cac dong hang khi don con o trang thai DRAFT');
    }
    if (dto.items) {
      await this.assertReferencesExist(order.supplierId, order.branchId, dto.items);
    }

    await this.dataSource.transaction(async (em) => {
      if (dto.items) {
        await em.delete(PurchaseOrderItem, { purchaseOrderId: order.id });
        await em.save(
          dto.items.map((line) =>
            em.create(PurchaseOrderItem, {
              purchaseOrderId: order.id,
              itemId: line.itemId,
              quantity: line.quantity,
              unitCost: line.unitCost,
              receivedQuantity: 0,
            }),
          ),
        );
        order.totalAmount = this.totalOf(dto.items);
      }
      if (dto.expectedDate !== undefined) order.expectedDate = dto.expectedDate;
      if (dto.note !== undefined) order.note = dto.note;
      if (dto.status !== undefined) order.status = dto.status;

      await em.save(PurchaseOrder, {
        id: order.id,
        expectedDate: order.expectedDate,
        note: order.note,
        status: order.status,
        totalAmount: order.totalAmount,
      });
    });

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    if (order.status !== PurchaseOrderStatus.DRAFT) {
      throw new ConflictException('Chi xoa duoc don con o trang thai DRAFT - don da gui thi huy');
    }
    await this.ordersRepository.softDelete(id);
  }

  /**
   * Tinh lai trang thai don tu so da nhan cua tung dong - goi tu `GoodsReceiptsService`
   * sau moi phieu nhap, trong CUNG transaction cua phieu do.
   *
   * Don da huy giu nguyen `CANCELLED`: nhan hang cua mot don da huy la tinh huong can
   * nguoi that xu ly, khong duoc am tham hoi sinh don.
   */
  async syncStatus(em: EntityManager, purchaseOrderId: string): Promise<PurchaseOrderStatus> {
    const order = await em.findOneOrFail(PurchaseOrder, { where: { id: purchaseOrderId } });
    if (order.status === PurchaseOrderStatus.CANCELLED) {
      return order.status;
    }

    const lines = await em.find(PurchaseOrderItem, { where: { purchaseOrderId } });
    const receivedAll = lines.every((line) => line.receivedQuantity >= line.quantity);
    const receivedAny = lines.some((line) => line.receivedQuantity > 0);

    const next = receivedAll
      ? PurchaseOrderStatus.RECEIVED
      : receivedAny
        ? PurchaseOrderStatus.PARTIALLY_RECEIVED
        : order.status;

    if (next !== order.status) {
      await em.update(PurchaseOrder, { id: purchaseOrderId }, { status: next });
    }
    return next;
  }

  // ------------------------------------------------------------------ Ben trong

  private assertOpen(order: PurchaseOrder): void {
    if (CLOSED_PURCHASE_ORDER_STATUSES.includes(order.status)) {
      throw new ConflictException(`Don ${order.poCode} da ${order.status}, khong sua duoc nua`);
    }
  }

  private totalOf(lines: readonly { quantity: number; unitCost: number }[]): number {
    return lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  }

  private async assertReferencesExist(
    supplierId: string,
    branchId: string,
    lines: readonly { itemId: string }[],
  ): Promise<void> {
    const supplier = await this.suppliersRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new BadRequestException('Supplier not found');

    const branch = await this.branchesRepository.findOne({ where: { id: branchId } });
    if (!branch) throw new BadRequestException('Branch not found');

    const itemIds = lines.map((line) => line.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException('Moi mat hang chi duoc xuat hien mot dong tren don');
    }

    const found = await this.itemsRepository.count({ where: { id: In(itemIds) } });
    if (found !== new Set(itemIds).size) {
      throw new BadRequestException('Mot hoac nhieu mat hang khong ton tai');
    }
  }
}
