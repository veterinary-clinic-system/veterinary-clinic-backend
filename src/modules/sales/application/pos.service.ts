import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import { PaymentsService } from '@/modules/billing/application';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { InventoryService } from '@/modules/catalog/application';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { CartItem } from '@/modules/sales/domain/entities/cart-item.entity';
import { Cart } from '@/modules/sales/domain/entities/cart.entity';
import { CartStatus } from '@/shared/common/enums/cart-status.enum';
import {
  InventoryReferenceType,
  InventoryTransactionType,
} from '@/shared/common/enums/inventory-transaction-type.enum';
import { InvoiceSource } from '@/shared/common/enums/invoice-source.enum';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { AddCartItemDto } from '@/modules/sales/presentation/dto/add-cart-item.dto';
import { CheckoutCartDto } from '@/modules/sales/presentation/dto/checkout-cart.dto';
import { CreateCartDto } from '@/modules/sales/presentation/dto/create-cart.dto';
import { QueryCartsDto } from '@/modules/sales/presentation/dto/query-carts.dto';
import { SearchPosProductsDto } from '@/modules/sales/presentation/dto/search-pos-products.dto';
import { SetCartDiscountDto } from '@/modules/sales/presentation/dto/set-cart-discount.dto';

const CART_DETAIL_RELATIONS = ['items', 'items.item', 'customer', 'branch'];
const SORTABLE_COLUMNS = new Set(['createdAt', 'updatedAt']);

/**
 * Chi hai loai mat hang nay ban duoc qua POS.
 *
 * Dich vu va xet nghiem KHONG ban o quay: chung phat sinh tu mot lan kham va di vao hoa
 * don kham (`source = CLINIC`) qua `BillingService.generateForAppointment`. Cho phep ban
 * dich vu o POS nghia la mot lan kham co the duoc thu tien hai lan qua hai duong khac
 * nhau ma khong ai doi chieu duoc.
 */
const SELLABLE_ITEM_TYPES: readonly ItemType[] = [ItemType.PRODUCT, ItemType.MEDICATION];

/** Gio bo do qua lau se bi cron danh dau `ABANDONED` - acceptance P8-T4. */
const CART_ABANDON_AFTER_HOURS = 24;

/** Mot dong trong luoi tim san pham cua man hinh POS. */
export interface PosProductRow {
  itemId: string;
  itemName: string;
  code: string;
  itemType: ItemType;
  unitPrice: number;
  sku: string | null;
  unit: string | null;
  /** So BAN DUOC (da loai lo het han - BR-11), khong phai so tong. */
  availableQuantity: number;
}

/** Tinh trang kho cua mot dong gio hang, tinh tai thoi diem doc. */
export interface CartItemStock {
  cartItemId: string;
  itemId: string;
  itemName: string;
  requested: number;
  /** So dung duoc o chi nhanh ban, DA loai lo het han (BR-11). */
  availableQuantity: number;
  insufficientStock: boolean;
}

/** Gio hang kem so tien va tinh trang kho - dang tra ve cua moi endpoint doc mot gio. */
export interface CartView {
  cart: Cart;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  stockCheck: CartItemStock[];
  hasInsufficientStock: boolean;
}

/**
 * Ban hang tai quay - SRS FR-19, UC-04.
 *
 * KIEM TRA TON KHO O DAY LA CANH BAO SOM, KHONG PHAI HANG RAO CUOI. Them mot mon vao gio
 * co kiem ton (BR-09) de nhan vien biet ngay thay vi den luc thu tien moi bao; nhung so
 * ton co the doi giua luc them va luc tra tien, nen `checkout` (P8-T5) kiem LAI MOT LAN
 * NUA trong transaction. Hai lop nay khong thua nhau: lop dau cho trai nghiem, lop sau
 * moi la cai bao dam ton khong am.
 */
@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    @InjectRepository(Cart) private readonly cartsRepository: Repository<Cart>,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly inventoryService: InventoryService,
    private readonly paymentsService: PaymentsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------- Gio hang

  async createCart(dto: CreateCartDto, staffUserId?: string): Promise<CartView> {
    const branch = await this.branchesRepository.findOne({ where: { id: dto.branchId } });
    if (!branch) {
      throw new BadRequestException('Branch not found');
    }
    if (dto.customerId) {
      const customer = await this.usersRepository.findOne({ where: { id: dto.customerId } });
      if (!customer) {
        throw new BadRequestException('Customer not found');
      }
    }

    const cart = await this.cartsRepository.save(
      this.cartsRepository.create({
        branchId: dto.branchId,
        customerId: dto.customerId ?? null,
        staffUserId: staffUserId ?? null,
        status: CartStatus.OPEN,
        discountAmount: 0,
        note: dto.note ?? null,
      }),
    );

    return this.viewOf(cart.id);
  }

  async findOne(id: string): Promise<CartView> {
    return this.viewOf(id);
  }

  async findAll(query: QueryCartsDto): Promise<PaginatedResultDto<Cart>> {
    const qb = this.cartsRepository
      .createQueryBuilder('cart')
      .leftJoinAndSelect('cart.items', 'item')
      .leftJoinAndSelect('item.item', 'catalogItem')
      .leftJoinAndSelect('cart.customer', 'customer');

    if (query.branchId) qb.andWhere('cart.branchId = :branchId', { branchId: query.branchId });
    if (query.status) qb.andWhere('cart.status = :status', { status: query.status });
    if (query.staffUserId) {
      qb.andWhere('cart.staffUserId = :staffUserId', { staffUserId: query.staffUserId });
    }

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'updatedAt';
    qb.orderBy(`cart.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  // ------------------------------------------------------- Tim hang de ban

  /**
   * Tim mat hang ban duoc tai mot chi nhanh - man hinh POS (SRS muc 12.5, NFR-02).
   *
   * TRA VE SO DUNG DUOC, KHONG PHAI SO TONG. `inventory_items.inventory_quantity` tinh ca
   * lo het han; ban theo con so do thi nhan vien bam mot mon "con 934" de roi bi tu choi
   * o buoc thanh toan vi thuc te chi con 30 chua het han (BR-11). Man hinh POS phai hien
   * dung con so ban duoc, va do la ly do cho nay tu tinh thay vi doc cot cache.
   *
   * Mot cau SQL cho ca danh sach thay vi goi `getAvailable` cho tung mat hang: danh muc
   * vai tram mon x mot truy van moi mon la cach chac chan nhat de vuot nguong 500ms
   * cua NFR-02.
   *
   * `sku` co trong ca dieu kien tim: may quet ma vach nhap chuoi SKU roi Enter, do la
   * duong nhap lieu chinh o quay.
   */
  async searchProducts(query: SearchPosProductsDto): Promise<PosProductRow[]> {
    const search = query.search?.trim();

    return this.dataSource.query(
      `
      SELECT item."id"                       AS "itemId",
             item."item_name"                AS "itemName",
             item."code"                     AS "code",
             item."itemType"                 AS "itemType",
             item."unit_price"::bigint       AS "unitPrice",
             product."sku"                   AS "sku",
             COALESCE(product."unit", medication."unit") AS "unit",
             COALESCE(
               SUM(batch."quantity") FILTER (
                 WHERE batch."expiry_date" IS NULL OR batch."expiry_date" >= CURRENT_DATE
               ), 0
             )::int                          AS "availableQuantity"
      FROM "items" item
      LEFT JOIN "products" product
             ON product."item_id" = item."id" AND product."deleted_at" IS NULL
      LEFT JOIN "medications" medication
             ON medication."item_id" = item."id" AND medication."deleted_at" IS NULL
      LEFT JOIN "inventory_items" inv
             ON inv."item_id" = item."id" AND inv."branch_id" = $1 AND inv."deleted_at" IS NULL
      LEFT JOIN "inventory_batches" batch
             ON batch."inventory_item_id" = inv."id" AND batch."deleted_at" IS NULL
      WHERE item."deleted_at" IS NULL
        AND item."active" = true
        AND item."itemType" = ANY($2)
        AND ($3::text IS NULL
             OR item."item_name" ILIKE '%' || $3 || '%'
             OR item."code" ILIKE '%' || $3 || '%'
             OR product."sku" ILIKE '%' || $3 || '%')
      GROUP BY item."id", product."sku", product."unit", medication."unit"
      ORDER BY item."item_name"
      LIMIT $4
      `,
      [query.branchId, SELLABLE_ITEM_TYPES, search || null, query.limit],
    );
  }

  // ----------------------------------------------------------------- Dong hang

  /**
   * Them mot mon vao gio, hoac CONG DON neu mon do da co trong gio.
   *
   * Kiem ton tinh tren TONG so sau khi them (so da co trong gio + so them moi), khong
   * chi tren so them moi: them 3 lan moi lan 5 cai voi ton 10 phai bi chan o lan thu ba,
   * chu khong phai lot ca ba lan vi lan nao cung "5 <= 10".
   */
  async addItem(cartId: string, dto: AddCartItemDto): Promise<CartView> {
    await this.dataSource.transaction(async (em) => {
      await this.lock(em, cartId);
      const cart = await this.loadOpenCart(em, cartId);
      const item = await this.loadSellableItem(em, dto.itemId);

      const existing = await em.findOne(CartItem, { where: { cartId, itemId: dto.itemId } });
      const quantity = (existing?.quantity ?? 0) + dto.quantity;

      await this.assertEnoughStock(em, cart.branchId, item, quantity);

      if (existing) {
        existing.quantity = quantity;
        // Gia tren dong duoc lam moi theo bang gia hien tai - nhan vien vua nhin thay
        // gia nay tren man hinh khi bam them.
        existing.unitPrice = item.unitPrice;
        await em.save(existing);
      } else {
        await em.save(
          em.create(CartItem, {
            cartId,
            itemId: dto.itemId,
            quantity: dto.quantity,
            unitPrice: item.unitPrice,
          }),
        );
      }

      await this.touch(em, cartId);
    });

    return this.viewOf(cartId);
  }

  /** Dat lai so luong mot dong. `quantity = 0` khong hop le - xoa dong thi goi `removeItem`. */
  async setItemQuantity(cartId: string, itemId: string, quantity: number): Promise<CartView> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('So luong phai la so nguyen duong');
    }

    await this.dataSource.transaction(async (em) => {
      await this.lock(em, cartId);
      const cart = await this.loadOpenCart(em, cartId);

      const line = await em.findOne(CartItem, { where: { cartId, itemId } });
      if (!line) {
        throw new NotFoundException('Dong hang khong co trong gio');
      }
      const item = await this.loadSellableItem(em, itemId);
      await this.assertEnoughStock(em, cart.branchId, item, quantity);

      line.quantity = quantity;
      line.unitPrice = item.unitPrice;
      await em.save(line);
      await this.touch(em, cartId);
    });

    return this.viewOf(cartId);
  }

  async removeItem(cartId: string, itemId: string): Promise<CartView> {
    await this.dataSource.transaction(async (em) => {
      await this.lock(em, cartId);
      await this.loadOpenCart(em, cartId);

      const result = await em.delete(CartItem, { cartId, itemId });
      if (!result.affected) {
        throw new NotFoundException('Dong hang khong co trong gio');
      }
      await this.touch(em, cartId);
    });

    return this.viewOf(cartId);
  }

  // ------------------------------------------------------------------ Giam gia

  /**
   * Ap giam gia THU CONG o muc gio hang - P8-T6.
   *
   * Pham vi co chu dich hep: mot so tien hoac mot phan tram tren ca gio, do nhan vien
   * quyet dinh. Chuong trinh khuyen mai va ma giam gia la *Could Have* cua SRS (Loyalty
   * Program) - dung o day thi phai co bang chuong trinh, dieu kien ap dung, han su dung
   * va lich su ap ma, ma khong co yeu cau nao trong SRS mo ta chung.
   *
   * PHAN TRAM DUOC QUY NGAY VE SO TIEN. Luu phan tram thi mot gio giam 10% se doi so tien
   * moi lan them bot mon - va con so khach vua duoc bao mieng khong con dung nua.
   *
   * `discountByUserId` ghi lai NGUOI ap - chuan bi cho audit log o P10. Tu hoa don truy
   * nguoc ve day duoc qua `carts.invoice_id`.
   */
  async setDiscount(
    cartId: string,
    dto: SetCartDiscountDto,
    actorUserId?: string,
  ): Promise<CartView> {
    if ((dto.amount === undefined) === (dto.percent === undefined)) {
      throw new BadRequestException('Gui MOT trong hai: `amount` (so tien) hoac `percent` (%)');
    }

    await this.dataSource.transaction(async (em) => {
      await this.lock(em, cartId);
      await this.loadOpenCart(em, cartId);

      const subtotal = await this.subtotalOf(em, cartId);
      const amount = dto.amount ?? Math.round((subtotal * (dto.percent as number)) / 100);

      if (amount > subtotal) {
        throw new ConflictException(
          `Giam gia ${amount} vuot qua tam tinh ${subtotal} cua gio hang`,
        );
      }

      await em.update(
        Cart,
        { id: cartId },
        {
          discountAmount: amount,
          discountByUserId: amount > 0 ? (actorUserId ?? null) : null,
          discountNote: dto.note ?? null,
          updatedAt: new Date(),
        },
      );
    });

    return this.viewOf(cartId);
  }

  /** Bo mot gio dang do (nhan vien bam "huy gio"). Khong dung cho gio da thanh toan. */
  async abandon(cartId: string): Promise<CartView> {
    const cart = await this.cartsRepository.findOne({ where: { id: cartId } });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }
    if (cart.status !== CartStatus.OPEN) {
      throw new ConflictException(`Gio hang dang o trang thai ${cart.status}, khong huy duoc`);
    }
    await this.cartsRepository.update({ id: cartId }, { status: CartStatus.ABANDONED });
    return this.viewOf(cartId);
  }

  // ------------------------------------------------------------- Thanh toan

  /**
   * Thanh toan mot gio hang - P8-T5, UC-04, BR-09 + BR-12, NFR-07.
   *
   * MOT TRANSACTION CHO TOAN BO, theo dung thu tu:
   *   1. Khoa gio (`pg_advisory_xact_lock` theo `cartId`)
   *   2. Kiem ton LAI MOT LAN NUA cho moi dong (BR-09)
   *   3. Tao `Invoice` (`source = POS`), chot gia TAI THOI DIEM NAY vao `invoice_items`
   *   4. Ghi `Payment` (FR-21)
   *   5. `InventoryService.issue` tung dong, `type = SALE` (BR-12)
   *   6. Gio -> `CHECKED_OUT`, tro ve hoa don vua lap
   *
   * Sai mot buoc la rollback tat ca. Tinh huong phai tranh bang moi gia: tien da thu,
   * kho da tru mot phan, ma khong co hoa don nao dung sau - luc do khong ai biet khach
   * da tra bao nhieu va da lay nhung gi.
   *
   * VI SAO KIEM TON LAI O BUOC 2 du da kiem luc them vao gio: gio co the mo tu sang, va
   * mon cuoi cung trong kho co the vua duoc quay ben canh ban mat. Khoa o buoc 1 chi noi
   * tiep hoa cac lan thanh toan CUNG MOT gio; hai gio khac nhau cung ban mon cuoi cung
   * duoc noi tiep hoa boi khoa `(itemId, branchId)` ben trong `InventoryService.issue`,
   * va do la cho ton kho khong bao gio xuong am - mot may thanh cong, may kia 409.
   */
  async checkout(
    cartId: string,
    dto: CheckoutCartDto,
    staffUserId?: string,
  ): Promise<{ cart: Cart; invoice: Invoice }> {
    const invoiceId = await this.dataSource.transaction(async (em) => {
      await this.lock(em, cartId);

      const cart = await em.findOne(Cart, { where: { id: cartId }, relations: ['items'] });
      if (!cart) {
        throw new NotFoundException('Cart not found');
      }
      if (cart.status !== CartStatus.OPEN) {
        throw new ConflictException(
          `Gio hang dang o trang thai ${cart.status}, khong thanh toan duoc nua`,
        );
      }
      const lines = cart.items ?? [];
      if (lines.length === 0) {
        throw new ConflictException('Gio hang trong, khong co gi de thanh toan');
      }

      // (2) Gom moi dong thieu vao MOT thong bao - cung ly le voi
      // `PrescriptionsService.dispense`: nguoi ban can biet ca gio thieu gi de xu ly mot
      // lan, chu khong phai bam - bao thieu - sua - bam lai nam lan.
      const shortages: string[] = [];
      for (const line of lines) {
        const available = await this.inventoryService.getAvailable(line.itemId, cart.branchId, em);
        if (available < line.quantity) {
          shortages.push(`${line.item.itemName}: can ${line.quantity}, kha dung ${available}`);
        }
      }
      if (shortages.length > 0) {
        throw new ConflictException(`BR-09: khong du ton kho - ${shortages.join('; ')}`);
      }

      // (3) Gia doc LAI tu danh muc, khong dung `cart_items.unit_price`: gia tren hoa don
      // phai la gia tai thoi diem thu tien. Xem comment dau `CartItem`.
      const priced = await Promise.all(
        lines.map(async (line) => {
          const item = await em.findOneOrFail(Item, { where: { id: line.itemId } });
          return { itemId: line.itemId, price: item.unitPrice, quantity: line.quantity };
        }),
      );

      const subtotal = priced.reduce((sum, line) => sum + line.price * line.quantity, 0);
      const discountAmount = cart.discountAmount;
      // Gia doc lai o buoc (3) co the thap hon luc ap giam gia (bang gia vua ha), hoac
      // nhan vien vua bo bot mon. KHONG tu cat bot giam gia cho vua: so tien giam la mot
      // con so da noi voi khach, sua no am tham la thu khong duoc phep lam voi tien.
      if (discountAmount > subtotal) {
        throw new ConflictException(
          `Giam gia ${discountAmount} vuot qua tam tinh ${subtotal} - dat lai giam gia truoc khi thanh toan`,
        );
      }
      const totalAmount = subtotal - discountAmount;

      const invoice = await em.save(
        em.create(Invoice, {
          source: InvoiceSource.POS,
          appointmentId: null,
          customerId: cart.customerId,
          branchId: cart.branchId,
          subtotal,
          discountAmount,
          taxAmount: 0,
          totalAmount,
          items: priced.map((line) => em.create(InvoiceItem, line)),
        }),
      );

      // `invoice_code` do CSDL sinh (cot `insert: false`), nen doc lai de co ma that thay
      // vi `undefined` trong ghi chu so cai - cung cach `generateForAppointment` lam.
      const invoiceCode = (
        await em.findOneOrFail(Invoice, {
          where: { id: invoice.id },
          select: { invoiceCode: true },
        })
      ).invoiceCode;

      // (4) Tien di qua `PaymentsService` - cua duy nhat cham vao tien cua hoa don.
      // Bo trong `amountPaid` = tra du; tra thieu thi hoa don ve `PARTIALLY_PAID` (ban
      // chiu cho khach quen no mot phan la co that o cua hang nho).
      //
      // Hoa don 0 dong (giam gia 100%, hang tang kem) KHONG sinh dong thanh toan nao -
      // mot chung tu thu 0 dong khong co y nghia gi va se lam ban bao cao doi soat. Trang
      // thai van phai duoc tinh lai de hoa don ve `PAID` thay vi ket o `PENDING`.
      const amountPaid = dto.amountPaid ?? totalAmount;
      if (amountPaid > 0) {
        await this.paymentsService.record(
          {
            invoiceId: invoice.id,
            amount: amountPaid,
            method: dto.paymentMethod,
            referenceCode: dto.referenceCode ?? null,
            receivedByUserId: staffUserId ?? null,
            note: dto.note ?? null,
          },
          em,
        );
      } else {
        await this.paymentsService.syncStatus(em, invoice.id);
      }

      // (5) BR-12: ban xong thi tru kho. Sau buoc nay ton khong the am - `issue` tu khoa
      // theo `(itemId, branchId)` va tu tu choi neu khong du.
      for (const line of priced) {
        await this.inventoryService.issue(
          {
            itemId: line.itemId,
            branchId: cart.branchId,
            quantity: line.quantity,
            type: InventoryTransactionType.SALE,
            referenceType: InventoryReferenceType.INVOICE,
            referenceId: invoice.id,
            performedByUserId: staffUserId ?? null,
            note: `Ban le theo hoa don ${invoiceCode}`,
          },
          em,
        );
      }

      // (6)
      await em.update(
        Cart,
        { id: cartId },
        { status: CartStatus.CHECKED_OUT, invoiceId: invoice.id },
      );

      return invoice.id;
    });

    const [cart, invoice] = await Promise.all([
      this.cartsRepository.findOneOrFail({
        where: { id: cartId },
        relations: CART_DETAIL_RELATIONS,
      }),
      this.dataSource.manager.findOneOrFail(Invoice, {
        where: { id: invoiceId },
        relations: ['items', 'items.item', 'customer', 'branch'],
      }),
    ]);
    return { cart, invoice };
  }

  // ------------------------------------------------------------------- Don dep

  /**
   * Don gio bo do - acceptance P8-T4.
   *
   * KHONG XOA, chi doi trang thai: mot gio bo do van la du lieu (mon nao hay bi bo lai o
   * buoc thanh toan la thong tin ban hang co that). Chay moi gio thay vi moi ngay de gio
   * bo do khong nam lai qua 25 tieng tren man hinh chon gio.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async abandonStaleCarts(): Promise<number> {
    const threshold = new Date(Date.now() - CART_ABANDON_AFTER_HOURS * 60 * 60 * 1000);
    const result = await this.cartsRepository.update(
      { status: CartStatus.OPEN, updatedAt: LessThan(threshold) },
      { status: CartStatus.ABANDONED },
    );

    if (result.affected) {
      this.logger.log(
        `Da danh dau ${result.affected} gio hang bo do (khong dong gi qua ${CART_ABANDON_AFTER_HOURS}h)`,
      );
    }
    return result.affected ?? 0;
  }

  // ------------------------------------------------------------------ Ben trong

  /**
   * Doc mot gio kem so tien va tinh trang kho.
   *
   * Ton duoc doc TAI THOI DIEM DOC chu khong luu vao gio - cung ly le voi
   * `PrescriptionsService.viewOf`: mot con so ton chup lai luc them vao gio se sai ngay
   * sau lan ban tiep theo, ma man hinh POS can so that o thoi diem dang nhin.
   */
  private async viewOf(cartId: string): Promise<CartView> {
    const cart = await this.cartsRepository.findOne({
      where: { id: cartId },
      relations: CART_DETAIL_RELATIONS,
    });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const stockCheck: CartItemStock[] = [];
    for (const line of cart.items ?? []) {
      const availableQuantity = await this.inventoryService.getAvailable(
        line.itemId,
        cart.branchId,
      );
      stockCheck.push({
        cartItemId: line.id,
        itemId: line.itemId,
        itemName: line.item.itemName,
        requested: line.quantity,
        availableQuantity,
        insufficientStock: availableQuantity < line.quantity,
      });
    }

    const subtotal = (cart.items ?? []).reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    );

    return {
      cart,
      subtotal,
      discountAmount: cart.discountAmount,
      totalAmount: Math.max(0, subtotal - cart.discountAmount),
      stockCheck,
      hasInsufficientStock: stockCheck.some((line) => line.insufficientStock),
    };
  }

  /** Tam tinh doc thang tu CSDL - dung khi chua can ca `CartView`. */
  private async subtotalOf(em: EntityManager, cartId: string): Promise<number> {
    const row = await em
      .createQueryBuilder(CartItem, 'line')
      .select('COALESCE(SUM(line.unit_price * line.quantity), 0)', 'total')
      .where('line.cart_id = :cartId', { cartId })
      .andWhere('line.deleted_at IS NULL')
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  /** BR-09 duoi dang mot phep kiem tra dung mot cho. Loi 409 kem so ton hien co. */
  private async assertEnoughStock(
    em: EntityManager,
    branchId: string,
    item: Item,
    quantity: number,
  ): Promise<void> {
    const available = await this.inventoryService.getAvailable(item.id, branchId, em);
    if (available < quantity) {
      throw new ConflictException(
        `BR-09: "${item.itemName}" chi con ${available} trong kho, khong ban duoc ${quantity}`,
      );
    }
  }

  private async loadOpenCart(em: EntityManager, cartId: string): Promise<Cart> {
    const cart = await em.findOne(Cart, { where: { id: cartId } });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }
    if (cart.status !== CartStatus.OPEN) {
      throw new ConflictException(
        `Gio hang dang o trang thai ${cart.status}, khong sua duoc nua. Mo gio moi de ban tiep.`,
      );
    }
    return cart;
  }

  private async loadSellableItem(em: EntityManager, itemId: string): Promise<Item> {
    const item = await em.findOne(Item, { where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    if (!item.active) {
      throw new ConflictException(`"${item.itemName}" da ngung kinh doanh`);
    }
    if (!SELLABLE_ITEM_TYPES.includes(item.itemType)) {
      throw new BadRequestException(
        `"${item.itemName}" la ${item.itemType}, khong ban qua quay - dich vu va xet nghiem ` +
          'di vao hoa don kham cua lich hen.',
      );
    }
    return item;
  }

  /**
   * Cham vao `updated_at` cua gio khi cac dong doi.
   *
   * Sua `cart_items` khong dung toi hang `carts`, nen khong co buoc nay thi mot gio dang
   * duoc thao tac lien tuc van bi cron dep sau 24h ke tu luc MO gio.
   */
  private touch(em: EntityManager, cartId: string): Promise<unknown> {
    return em.update(Cart, { id: cartId }, { updatedAt: new Date() });
  }

  /** Khoa theo gio trong pham vi transaction - cung mau voi `InventoryService.lock`. */
  private lock(em: EntityManager, cartId: string): Promise<unknown> {
    return em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cart:${cartId}`]);
  }
}
