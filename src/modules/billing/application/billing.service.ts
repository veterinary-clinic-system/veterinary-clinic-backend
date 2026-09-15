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

const INVOICE_DETAIL_RELATIONS = ['items', 'items.item', 'appointment', 'customer', 'branch'];

const SORTABLE_COLUMNS = new Set(['createdAt', 'updatedAt', 'paid', 'paidAt', 'totalAmount']);

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

    @InjectRepository(Item) private readonly itemsRepository: Repository<Item>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    private readonly paymentsService: PaymentsService,
    private readonly inventoryService: InventoryService,
  ) {}

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

        relations: ['service', 'service.item', 'pet'],
      });
      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }

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

      lines.push({
        itemId: appointment.service.item.id,
        price: appointment.service.item.unitPrice,
        quantity: 1,
      });

      if (medicalRecord) {
        for (const prescription of medicalRecord.prescriptions ?? []) {
          for (const prescriptionItem of prescription.items ?? []) {
            lines.push({
              itemId: prescriptionItem.medication.item.id,
              price: prescriptionItem.medication.item.unitPrice,

              quantity: prescriptionItem.quantity,
            });
          }
        }

        for (const labTestOrder of medicalRecord.labTestOrders ?? []) {
          const matchedItem = await this.itemsRepository.findOne({
            where: { itemType: ItemType.LAB_TEST, itemName: ILike(labTestOrder.testName) },
          });
          if (matchedItem) {
            lines.push({ itemId: matchedItem.id, price: matchedItem.unitPrice, quantity: 1 });
          } else {

            this.logger.warn(
              `No active LAB_TEST item matches lab test order "${labTestOrder.testName}" ` +
                `(order ${labTestOrder.id}) on appointment ${appointmentId} - skipping this line`,
            );
          }
        }
      }

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

  async findByAppointment(appointmentId: string): Promise<Invoice | null> {
    return this.invoicesRepository.findOne({
      where: { appointmentId },
      relations: INVOICE_DETAIL_RELATIONS,
    });
  }

  async findAll(query: QueryInvoicesDto): Promise<PaginatedResultDto<Invoice>> {
    const qb = this.invoicesRepository.createQueryBuilder('invoice');

    if (query.branchId) {

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

  async pay(id: string, dto: PayInvoiceDto, receivedByUserId?: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('This invoice has already been paid');
    }

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

  private assertEditable(invoice: Invoice): void {
    if (LOCKED_INVOICE_STATUSES.has(invoice.status)) {
      throw new ConflictException(
        `BR-14: hoa don ${invoice.invoiceCode} dang o trang thai ${invoice.status}, ` +
          'khong sua truc tiep duoc. Dung nghiep vu hoan tien hoac huy hoa don.',
      );
    }
  }
}
