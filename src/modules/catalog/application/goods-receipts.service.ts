import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { GoodsReceiptItem } from '@/modules/catalog/domain/entities/goods-receipt-item.entity';
import { GoodsReceipt } from '@/modules/catalog/domain/entities/goods-receipt.entity';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { PurchaseOrderItem } from '@/modules/catalog/domain/entities/purchase-order-item.entity';
import { PurchaseOrder } from '@/modules/catalog/domain/entities/purchase-order.entity';
import { Supplier } from '@/modules/catalog/domain/entities/supplier.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import {
  InventoryReferenceType,
  InventoryTransactionType,
} from '@/shared/common/enums/inventory-transaction-type.enum';
import { PurchaseOrderStatus } from '@/shared/common/enums/purchase-order-status.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { toDateOnly } from '@/modules/catalog/domain/inventory-allocation.util';
import { InventoryService } from '@/modules/catalog/application/inventory.service';
import { PurchaseOrdersService } from '@/modules/catalog/application/purchase-orders.service';
import {
  CreateGoodsReceiptDto,
  CreateGoodsReceiptItemDto,
} from '@/modules/catalog/presentation/dto/create-goods-receipt.dto';
import { QueryGoodsReceiptsDto } from '@/modules/catalog/presentation/dto/query-goods-receipts.dto';

const SORTABLE_COLUMNS = new Set(['receivedDate', 'totalAmount', 'createdAt']);
const DETAIL_RELATIONS = ['items', 'items.item', 'supplier', 'branch', 'purchaseOrder'];

/**
 * Nhan hang vao kho - SRS UC-05, BR-13.
 *
 * TOAN BO MOT PHIEU NAM TRONG MOT TRANSACTION. Day khong phai su can than thua: nhap
 * kho duoc mot nua roi loi la tinh huong TE NHAT co the xay ra voi du lieu kho - ton
 * tang cho vai dong, so cai co vai dong, so da nhan cua don thi lech, va khong ai biet
 * phai sua tu dau. Thu tu trong transaction:
 *
 *   1. Kiem tra moi dong (mat hang ton tai, khong nhan vuot so dat)  <- fail nhanh o day
 *   2. Luu phieu + cac dong
 *   3. `InventoryService.receive` tung dong (tang lo + so tong + ghi so cai)
 *   4. Cong `receivedQuantity` cua don, roi tinh lai trang thai don
 *
 * Buoc 1 lam TRUOC khi ghi bat cu thu gi, de truong hop bi tu choi thuong gap nhat
 * (nhan vuot so dat) khong phai dua vao rollback.
 */
@Injectable()
export class GoodsReceiptsService {
  constructor(
    @InjectRepository(GoodsReceipt) private readonly receiptsRepository: Repository<GoodsReceipt>,
    @InjectRepository(Supplier) private readonly suppliersRepository: Repository<Supplier>,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(Item) private readonly itemsRepository: Repository<Item>,
    private readonly inventoryService: InventoryService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateGoodsReceiptDto, receivedByUserId?: string): Promise<GoodsReceipt> {
    await this.assertReferencesExist(dto);

    const receiptId = await this.dataSource.transaction(async (em) => {
      const purchaseOrder = dto.purchaseOrderId
        ? await this.loadOpenPurchaseOrder(em, dto.purchaseOrderId, dto.branchId)
        : null;

      const orderLines = purchaseOrder
        ? await this.loadOrderLines(em, purchaseOrder.id)
        : new Map();
      this.assertNotOverReceiving(dto.items, orderLines);

      const receipt = await em.save(
        em.create(GoodsReceipt, {
          purchaseOrderId: purchaseOrder?.id ?? null,
          supplierId: dto.supplierId,
          branchId: dto.branchId,
          receivedDate: dto.receivedDate ?? toDateOnly(new Date()),
          totalAmount: dto.items.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
          receivedByUserId: receivedByUserId ?? null,
          note: dto.note ?? null,
        }),
      );

      for (const line of dto.items) {
        const batch = await this.inventoryService.receive(
          {
            itemId: line.itemId,
            branchId: dto.branchId,
            batchNo: line.batchNo,
            expiryDate: line.expiryDate ?? null,
            quantity: line.quantity,
            costPrice: line.unitCost,
            supplierId: dto.supplierId,
            goodsReceiptId: receipt.id,
            type: InventoryTransactionType.PURCHASE,
            referenceType: InventoryReferenceType.GOODS_RECEIPT,
            referenceId: receipt.id,
            performedByUserId: receivedByUserId ?? null,
            note: `Nhap theo phieu ${receipt.receiptCode}`,
          },
          em,
        );

        await em.save(
          em.create(GoodsReceiptItem, {
            goodsReceiptId: receipt.id,
            purchaseOrderItemId: line.purchaseOrderItemId ?? null,
            itemId: line.itemId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            batchNo: line.batchNo,
            expiryDate: line.expiryDate ?? null,
            batchId: batch.id,
          }),
        );

        if (line.purchaseOrderItemId) {
          await em.increment(
            PurchaseOrderItem,
            { id: line.purchaseOrderItemId },
            'receivedQuantity',
            line.quantity,
          );
        }
      }

      if (purchaseOrder) {
        await this.purchaseOrdersService.syncStatus(em, purchaseOrder.id);
      }

      return receipt.id;
    });

    return this.findOne(receiptId);
  }

  async findAll(query: QueryGoodsReceiptsDto): Promise<PaginatedResultDto<GoodsReceipt>> {
    const qb = this.receiptsRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.supplier', 'supplier')
      .leftJoinAndSelect('receipt.branch', 'branch')
      .leftJoinAndSelect('receipt.purchaseOrder', 'purchaseOrder');

    if (query.branchId) qb.andWhere('receipt.branchId = :branchId', { branchId: query.branchId });
    if (query.supplierId) {
      qb.andWhere('receipt.supplierId = :supplierId', { supplierId: query.supplierId });
    }
    if (query.purchaseOrderId) {
      qb.andWhere('receipt.purchaseOrderId = :purchaseOrderId', {
        purchaseOrderId: query.purchaseOrderId,
      });
    }
    if (query.search) {
      qb.andWhere('receipt.receiptCode ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.fromDate) {
      qb.andWhere('receipt.receivedDate >= :fromDate', { fromDate: query.fromDate });
    }
    if (query.toDate) qb.andWhere('receipt.receivedDate <= :toDate', { toDate: query.toDate });

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`receipt.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<GoodsReceipt> {
    const receipt = await this.receiptsRepository.findOne({
      where: { id },
      relations: DETAIL_RELATIONS,
    });
    if (!receipt) {
      throw new NotFoundException('Goods receipt not found');
    }
    return receipt;
  }

  // ------------------------------------------------------------------ Ben trong

  private async loadOpenPurchaseOrder(
    em: EntityManager,
    purchaseOrderId: string,
    branchId: string,
  ): Promise<PurchaseOrder> {
    const order = await em.findOne(PurchaseOrder, { where: { id: purchaseOrderId } });
    if (!order) {
      throw new BadRequestException('Purchase order not found');
    }
    if (order.branchId !== branchId) {
      throw new BadRequestException('Phieu nhap phai cung chi nhanh voi don dat hang');
    }
    if (order.status === PurchaseOrderStatus.CANCELLED) {
      throw new ConflictException(`Don ${order.poCode} da bi huy, khong nhan hang duoc`);
    }
    if (order.status === PurchaseOrderStatus.RECEIVED) {
      throw new ConflictException(`Don ${order.poCode} da nhan du hang`);
    }
    if (order.status === PurchaseOrderStatus.DRAFT) {
      throw new ConflictException(
        `Don ${order.poCode} chua gui nha cung cap - chuyen sang ORDERED truoc khi nhan hang`,
      );
    }
    return order;
  }

  private async loadOrderLines(
    em: EntityManager,
    purchaseOrderId: string,
  ): Promise<Map<string, PurchaseOrderItem>> {
    const lines = await em.find(PurchaseOrderItem, { where: { purchaseOrderId } });
    return new Map(lines.map((line) => [line.id, line]));
  }

  /**
   * CHOT HUONG cho tinh huong "nhan vuot so dat" ma P6-T5 doi phai chon mot: CAM, tra
   * 409. Ly do: nhan nhieu hon so dat nghia la hoac don ghi sai, hoac nha cung cap giao
   * nham - ca hai deu phai sua chung tu truoc, khong duoc am tham nhan vao kho roi de
   * lai mot don co so nhan lon hon so dat (khong con doi soat cong no duoc). Muon nhan
   * them that thi sua don (khi con DRAFT) hoac lap mot phieu nhap khong theo don.
   *
   * Rang buoc nay duoc lap lai o CSDL: `chk_purchase_order_items_received_not_exceeding`.
   */
  private assertNotOverReceiving(
    lines: readonly CreateGoodsReceiptItemDto[],
    orderLines: Map<string, PurchaseOrderItem>,
  ): void {
    /** Cong don trong PHAM VI mot phieu - hai dong cung tro ve mot dong don van phai cong lai. */
    const receivingByOrderLine = new Map<string, number>();

    for (const line of lines) {
      if (!line.purchaseOrderItemId) continue;

      const orderLine = orderLines.get(line.purchaseOrderItemId);
      if (!orderLine) {
        throw new BadRequestException('Dong don dat hang khong thuoc don da chon');
      }
      if (orderLine.itemId !== line.itemId) {
        throw new BadRequestException(
          'Mat hang cua dong nhap khong khop mat hang cua dong don dat',
        );
      }

      const pending = (receivingByOrderLine.get(orderLine.id) ?? 0) + line.quantity;
      receivingByOrderLine.set(orderLine.id, pending);

      if (orderLine.receivedQuantity + pending > orderLine.quantity) {
        throw new ConflictException(
          `Nhan vuot so dat: dong dat ${orderLine.quantity}, da nhan ${orderLine.receivedQuantity}, ` +
            `dang nhan them ${pending}`,
        );
      }
    }
  }

  private async assertReferencesExist(dto: CreateGoodsReceiptDto): Promise<void> {
    const supplier = await this.suppliersRepository.findOne({ where: { id: dto.supplierId } });
    if (!supplier) throw new BadRequestException('Supplier not found');

    const branch = await this.branchesRepository.findOne({ where: { id: dto.branchId } });
    if (!branch) throw new BadRequestException('Branch not found');

    const itemIds = [...new Set(dto.items.map((line) => line.itemId))];
    const found = await this.itemsRepository.count({ where: { id: In(itemIds) } });
    if (found !== itemIds.length) {
      throw new BadRequestException('Mot hoac nhieu mat hang khong ton tai');
    }
  }
}
