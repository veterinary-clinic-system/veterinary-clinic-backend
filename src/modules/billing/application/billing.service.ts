import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { InventoryService } from '@/modules/catalog/application';
import { InvoiceSource } from '@/shared/common/enums/invoice-source.enum';
import { InvoiceStatus, LOCKED_INVOICE_STATUSES } from '@/shared/common/enums/invoice-status.enum';
import {
  InventoryReferenceType,
  InventoryTransactionType,
} from '@/shared/common/enums/inventory-transaction-type.enum';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { PayInvoiceDto } from '@/modules/billing/presentation/dto/pay-invoice.dto';
import { QueryInvoicesDto } from '@/modules/billing/presentation/dto/query-invoices.dto';
import { RefundInvoiceDto } from '@/modules/billing/presentation/dto/refund-invoice.dto';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from '@/modules/billing/application/ports/payment.port';
import { PaymentPendingException } from '@/modules/billing/application/payment-pending.exception';
import { PaymentsService } from '@/modules/billing/application/payments.service';

/**
 * Full detail relations for a single-invoice read (generate/get/pay/by-appointment).
 *
 * `customer` an toan de nap kem: `users.password_hash` khai bao `select: false` nen
 * khong bao gio ra khoi CSDL qua duong nay.
 */
const INVOICE_DETAIL_RELATIONS = ['items', 'items.item', 'appointment', 'customer', 'branch'];

/** Columns the list endpoint is allowed to sort by - keeps `?sortBy=` from reaching raw SQL. */
const SORTABLE_COLUMNS = new Set(['createdAt', 'updatedAt', 'paid', 'paidAt', 'totalAmount']);

/** Mot dong hoa don do nguoi goi cung cap (P8-T3, va POS o P8-T5). */
export interface InvoiceLineInput {
  itemId: string;
  price: number;
  quantity: number;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Invoice) private readonly invoicesRepository: Repository<Invoice>,
    // Appointment/Examination are only ever read here through the transaction manager
    // (see generateForAppointment) - only Item needs its own repository, per spec, for
    // the lab-test-to-catalog-item lookup.
    @InjectRepository(Item) private readonly itemsRepository: Repository<Item>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    private readonly paymentsService: PaymentsService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Generates the Invoice for an appointment from whatever billable records exist for
   * it right now: the booked Service (always), plus - if a doctor has already written
   * up an Examination for the visit - one line per prescribed medication and one per
   * ordered lab test. Idempotent: calling this again after the invoice already exists
   * just returns it unchanged rather than erroring or duplicating lines.
   *
   * Wrapped in a single transaction, guarded by a per-appointment Postgres advisory
   * lock (same pattern as AppointmentsService.createBooking/update) so two concurrent
   * "generate invoice" calls for the same appointment can't both pass the
   * already-exists check and insert duplicate invoices.
   */
  async generateForAppointment(appointmentId: string): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [appointmentId]);

      const existing = await manager.findOne(Invoice, {
        where: { appointmentId },
        relations: INVOICE_DETAIL_RELATIONS,
      });
      if (existing) {
        return existing;
      }

      const appointment = await manager.findOne(Appointment, {
        where: { id: appointmentId },
        // `service.item` is technically eager on Service already (see service.entity.ts)
        // but is listed explicitly anyway - mirrors the convention already established
        // in appointments.service.ts's own `findOne`.
        //
        // `pet` moi them o P8-T1: hoa don gio luu thang `customerId`, va chu thu cung
        // chinh la khach hang cua hoa don kham.
        relations: ['service', 'service.item', 'pet'],
      });
      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }

      // Ho so benh an la TUY CHON - van lap duoc hoa don cho mot lan kham dich vu don
      // thuan (chi dong dich vu) truoc khi bac si ghi bat cu thu gi.
      //
      // Tu P4-T6 doc qua `MedicalRecord` chu khong qua `Examination`: khoa ngoai cua
      // don thuoc/xet nghiem da chuyen sang ho so. Ket qua ve tien KHONG DOI voi du
      // lieu cu - backfill sinh dung mot ho so cho moi phieu kham, nen cung tap don
      // thuoc va cung tap chi dinh xet nghiem di vao hoa don nhu truoc.
      const medicalRecord = await manager.findOne(MedicalRecord, {
        where: { appointmentId },
        relations: [
          'prescriptions',
          'prescriptions.items',
          'prescriptions.items.medication',
          'prescriptions.items.medication.item',
          'labTestOrders',
        ],
      });

      const lines: Array<{ itemId: string; price: number; quantity: number }> = [];

      // (a) the booked service itself - always billed, one line, quantity 1.
      lines.push({
        itemId: appointment.service.item.id,
        price: appointment.service.item.unitPrice,
        quantity: 1,
      });

      // (b) one line per prescribed medication across every prescription on the record.
      if (medicalRecord) {
        for (const prescription of medicalRecord.prescriptions ?? []) {
          for (const prescriptionItem of prescription.items ?? []) {
            lines.push({
              itemId: prescriptionItem.medication.item.id,
              price: prescriptionItem.medication.item.unitPrice,
              // Tu P7-T1: tinh tien theo SO LUONG THUC CAP do bac si nhap, khong con
              // phai lay tam `durationDays` nua. Hoa don da lap truoc do khong doi so:
              // gia da duoc chot trong `invoice_items`, va migration
              // `1793000000000` backfill `quantity = duration_days` nen ngay ca khi
              // lap lai hoa don cho don thuoc cu, ket qua van y het cong thuc cu.
              quantity: prescriptionItem.quantity,
            });
          }
        }

        // (c) one line per ordered lab test, resolved against the Item catalog by name.
        // Catalog rows aren't written anywhere in this transaction, so a plain
        // (non-transactional) repository read is fine here.
        for (const labTestOrder of medicalRecord.labTestOrders ?? []) {
          const matchedItem = await this.itemsRepository.findOne({
            where: { itemType: ItemType.LAB_TEST, itemName: ILike(labTestOrder.testName) },
          });
          if (matchedItem) {
            lines.push({ itemId: matchedItem.id, price: matchedItem.unitPrice, quantity: 1 });
          } else {
            // ASSUMPTION: a lab test ordered without a matching priced catalog Item
            // (name typo, or a test type the price list hasn't caught up with yet)
            // should not block the rest of the invoice from being generated - it's
            // just skipped and logged so billing staff can follow up manually.
            this.logger.warn(
              `No active LAB_TEST item matches lab test order "${labTestOrder.testName}" ` +
                `(order ${labTestOrder.id}) on appointment ${appointmentId} - skipping this line`,
            );
          }
        }
      }

      // Tu P8-T1 tong tien duoc CHOT vao hoa don ngay luc lap. Hoa don kham chua co
      // giam gia (P8-T6 chi lam giam gia o muc gio hang POS) va chua co thue, nen
      // `total = subtotal`. Cong thuc van viet day du de cho nay khong phai sua lai khi
      // hai con so kia bat dau khac 0.
      const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

      const invoice = manager.create(Invoice, {
        source: InvoiceSource.CLINIC,
        appointmentId,
        customerId: appointment.pet.ownerId,
        branchId: appointment.branchId,
        subtotal,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: subtotal,
        paid: false,
        paymentMethod: null,
        paidAt: null,
        // Invoice.items has { cascade: true } (see invoice.entity.ts), so saving the
        // Invoice with `items` populated inserts the Invoice and every InvoiceItem in
        // one go - same pattern ExaminationsService uses for Prescription + its items.
        items: lines.map((line) => manager.create(InvoiceItem, line)),
      });
      const saved = await manager.save(invoice);

      return manager.findOne(Invoice, {
        where: { id: saved.id },
        relations: INVOICE_DETAIL_RELATIONS,
      }) as Promise<Invoice>;
    });
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id },
      relations: INVOICE_DETAIL_RELATIONS,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  /**
   * Lookup by appointment id instead of invoice id, for callers that only know the
   * appointment (e.g. "has this visit been billed yet?"). Returns `null` rather than
   * throwing when no invoice exists yet - this is a routine "not generated yet" state,
   * not an error, so callers get a clean `null` body instead of having to catch a 404.
   */
  async findByAppointment(appointmentId: string): Promise<Invoice | null> {
    return this.invoicesRepository.findOne({
      where: { appointmentId },
      relations: INVOICE_DETAIL_RELATIONS,
    });
  }

  /**
   * Paginated list backing a billing staff table view. Filtering/sorting/pagination all
   * run against a query builder that only *joins* (not selects) `appointment`, because
   * `invoice.items` is a to-many relation - `leftJoinAndSelect`-ing it directly here
   * would make Postgres' LIMIT/OFFSET apply to the joined item rows instead of distinct
   * invoices, silently truncating results. Instead the filtered/sorted page of invoice
   * ids is resolved first, then the full entity graph is re-fetched for just those ids.
   */
  async findAll(query: QueryInvoicesDto): Promise<PaginatedResultDto<Invoice>> {
    const qb = this.invoicesRepository.createQueryBuilder('invoice');

    if (query.branchId) {
      // Tu P8-T1 loc thang tren `invoice.branchId` chu khong qua lich hen: hoa don POS
      // khong co lich hen, va mot INNER/LEFT JOIN sang `appointments` de loc chi nhanh
      // se lang le lam bien mat toan bo hoa don ban le khoi danh sach.
      qb.andWhere('invoice.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.source) {
      qb.andWhere('invoice.source = :source', { source: query.source });
    }
    if (query.status) {
      qb.andWhere('invoice.status = :status', { status: query.status });
    }
    if (query.customerId) {
      qb.andWhere('invoice.customerId = :customerId', { customerId: query.customerId });
    }
    if (query.search) {
      qb.andWhere('invoice.invoiceCode ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.fromDate) {
      qb.andWhere('invoice.createdAt >= :fromDate', {
        fromDate: new Date(`${query.fromDate}T00:00:00`),
      });
    }
    if (query.toDate) {
      qb.andWhere('invoice.createdAt <= :toDate', {
        toDate: new Date(`${query.toDate}T23:59:59.999`),
      });
    }
    if (query.paid !== undefined) {
      qb.andWhere('invoice.paid = :paid', { paid: query.paid });
    }

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`invoice.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [pageRows, total] = await qb.getManyAndCount();
    const ids = pageRows.map((invoice) => invoice.id);

    const detailed = ids.length
      ? await this.invoicesRepository.find({
          where: { id: In(ids) },
          relations: INVOICE_DETAIL_RELATIONS,
        })
      : [];
    const byId = new Map(detailed.map((invoice) => [invoice.id, invoice]));
    const data = ids.map((id) => byId.get(id)!);

    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  /**
   * Ghi nhan thanh toan cho hoa don, di qua port PaymentProvider.
   *
   * Chi ghi nhan tien khi cong thanh toan bao da thu duoc (`settled`). Voi adapter thu
   * tien tai quay thi dieu do dung ngay lap tuc; voi cong truc tuyen (VNPay) thi hoa don
   * van o trang thai chua thanh toan cho den khi cong goi lai IPN - tra ve `redirectUrl`
   * de nguoi dung sang trang thanh toan.
   *
   * Tu P8-T2 khong con tu ghi `paid` nua: dong tien di vao bang `payments` va trang thai
   * hoa don do `PaymentsService.syncStatus` tinh lai. Bo trong `amount` = tra het phan
   * con lai, nen loi goi cu (chi gui `paymentMethod`) van y nguyen hanh vi.
   */
  async pay(id: string, dto: PayInvoiceDto, receivedByUserId?: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('This invoice has already been paid');
    }

    // So phai thu lay tu bang `payments` chu khong tu `invoice.totalAmount`: hoa don da
    // tra mot phan thi lan nay chi con phai thu phan con lai.
    const balance = await this.paymentsService.balanceOf(id);
    const amount = dto.amount ?? balance.outstandingAmount;
    if (amount <= 0) {
      throw new ConflictException('Hoa don khong con so du phai thu');
    }

    const result = await this.paymentProvider.charge({
      invoiceId: invoice.id,
      amount,
      method: dto.paymentMethod,
    });

    if (!result.settled) {
      throw new PaymentPendingException(result.redirectUrl!);
    }

    await this.paymentsService.record({
      invoiceId: id,
      amount,
      method: dto.paymentMethod,
      referenceCode: dto.referenceCode ?? null,
      receivedByUserId: receivedByUserId ?? null,
      note: dto.note ?? null,
    });

    return this.findOne(id);
  }

  // ------------------------------------------------------------------- BR-14

  /**
   * Sua cac dong cua mot hoa don CHUA thu dong nao - P8-T3.
   *
   * BR-14: *"Invoice da thanh toan khong duoc chinh sua truc tiep. Neu can thay doi phai
   * dung nghiep vu refund/cancellation."* Cho nay la mot trong hai cua duy nhat vao cac
   * dong hoa don, nen luat duoc thuc thi ngay tai day thay vi trong tam mot guard.
   *
   * Vi sao van can sua duoc: hoa don kham lap ra roi moi phat hien thieu mot dich vu da
   * lam la chuyen thuong ngay o quay. Cam sua HOAN TOAN thi le tan buoc phai xoa hoa don
   * roi lap lai - vua mat ma hoa don vua khong con dau vet gi.
   */
  async replaceItems(id: string, lines: InvoiceLineInput[]): Promise<Invoice> {
    if (lines.length === 0) {
      throw new BadRequestException('Hoa don phai co it nhat mot dong');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`invoice:${id}`]);

      const invoice = await manager.findOne(Invoice, { where: { id } });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      this.assertEditable(invoice);

      const itemIds = [...new Set(lines.map((line) => line.itemId))];
      const found = await manager.count(Item, { where: { id: In(itemIds) } });
      if (found !== itemIds.length) {
        throw new BadRequestException('Mot hoac nhieu mat hang khong ton tai');
      }

      await manager.delete(InvoiceItem, { invoiceId: id });
      await manager.save(
        lines.map((line) =>
          manager.create(InvoiceItem, {
            invoiceId: id,
            itemId: line.itemId,
            price: line.price,
            quantity: line.quantity,
          }),
        ),
      );

      const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
      if (invoice.discountAmount > subtotal) {
        throw new ConflictException(
          `Giam gia ${invoice.discountAmount} vuot qua tam tinh moi ${subtotal} - sua giam gia truoc`,
        );
      }
      await manager.update(
        Invoice,
        { id },
        {
          subtotal,
          totalAmount: subtotal - invoice.discountAmount + invoice.taxAmount,
        },
      );
    });

    return this.findOne(id);
  }

  /**
   * Hoan tien - P8-T3, BR-14.
   *
   * HAI VIEC TRONG MOT TRANSACTION: ghi dong `payments` am, va - chi voi hoa don POS -
   * tra hang ve kho bang mot dong so cai `RETURN`.
   *
   * VI SAO CHI POS: hang cua hoa don POS duoc xuat kho ngay luc thanh toan (`SALE`, P8-T5),
   * nen hoan tien thi hang quay ve. Hoa don KHAM thi khac - thuoc di ra khoi kho o buoc
   * cap phat cua duoc si (`DISPENSE`, P7), doc lap voi viec thu tien; hoan tien mot hoa
   * don kham ma cong hang tro lai se tao ra hang khong co that trong kho. Muon tra lai
   * thuoc da cap thi do la mot nghiep vu nhap tra rieng o man hinh kho.
   */
  async refund(id: string, dto: RefundInvoiceDto, actorUserId?: string): Promise<Invoice> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`invoice:${id}`]);

      const invoice = await manager.findOne(Invoice, {
        where: { id },
        relations: ['items'],
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new ConflictException('Hoa don da huy, khong co gi de hoan');
      }

      const balance = await this.paymentsService.balanceOf(id, manager);
      const amount = dto.amount ?? balance.paidAmount;

      await this.paymentsService.refund(
        {
          invoiceId: id,
          amount,
          method: dto.paymentMethod ?? invoice.paymentMethod ?? PaymentMethod.CASH,
          receivedByUserId: actorUserId ?? null,
          note: dto.reason,
        },
        manager,
      );

      if (invoice.source === InvoiceSource.POS) {
        for (const line of invoice.items ?? []) {
          await this.inventoryService.receive(
            {
              itemId: line.itemId,
              branchId: invoice.branchId,
              // Hang tra ve gom vao mot lo ky thuat theo hoa don: khong biet duoc mon
              // khach mang tra la thuoc lo nao, va don no vao lo cu se lam sai han dung
              // cua lo do.
              batchNo: `TR-${invoice.invoiceCode}`,
              expiryDate: null,
              quantity: line.quantity,
              type: InventoryTransactionType.RETURN,
              referenceType: InventoryReferenceType.INVOICE,
              referenceId: invoice.id,
              performedByUserId: actorUserId ?? null,
              note: `Hoan hang theo hoa don ${invoice.invoiceCode}: ${dto.reason}`,
            },
            manager,
          );
        }
      }
    });

    return this.findOne(id);
  }

  /**
   * Huy hoa don - P8-T3.
   *
   * CHI KHI CHUA THU DUOC DONG NAO. Da thu roi ma van cho huy thi tien trong ket khong
   * con chung tu nao dung sau, va do dung la dieu BR-14 sinh ra de chan - duong di dung
   * la hoan tien.
   */
  async cancel(id: string, reason: string): Promise<Invoice> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`invoice:${id}`]);

      const invoice = await manager.findOne(Invoice, { where: { id } });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new ConflictException('Hoa don da bi huy roi');
      }

      const balance = await this.paymentsService.balanceOf(id, manager);
      if (balance.paidAmount > 0 || balance.hasRefund) {
        throw new ConflictException(
          `BR-14: hoa don ${invoice.invoiceCode} da thu ${balance.paidAmount} - khong huy duoc, ` +
            'dung nghiep vu hoan tien (POST /billing/invoices/:id/refund).',
        );
      }

      await manager.update(
        Invoice,
        { id },
        {
          status: InvoiceStatus.CANCELLED,
          paid: false,
          paidAt: null,
          cancelReason: reason,
          cancelledAt: new Date(),
        },
      );
    });

    return this.findOne(id);
  }

  /** BR-14 duoi dang mot phep kiem tra dung mot cho - moi duong sua dong deu goi no. */
  private assertEditable(invoice: Invoice): void {
    if (LOCKED_INVOICE_STATUSES.has(invoice.status)) {
      throw new ConflictException(
        `BR-14: hoa don ${invoice.invoiceCode} dang o trang thai ${invoice.status}, ` +
          'khong sua truc tiep duoc. Dung nghiep vu hoan tien hoac huy hoa don.',
      );
    }
  }
}
