import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Payment } from '@/modules/billing/domain/entities/payment.entity';
import { InvoiceStatus, deriveInvoiceStatus } from '@/shared/common/enums/invoice-status.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PaymentStatus, SETTLED_PAYMENT_STATUSES } from '@/shared/common/enums/payment-status.enum';
import { StaffNotificationsService } from '@/modules/notification/application';
import { StaffNotificationType } from '@/shared/common/enums/staff-notification.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { QueryPaymentsDto } from '@/modules/billing/presentation/dto/query-payments.dto';

const SORTABLE_COLUMNS = new Set(['createdAt', 'paidAt', 'amount']);

export interface RecordPaymentParams {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  
  status?: PaymentStatus;
  referenceCode?: string | null;
  receivedByUserId?: string | null;
  note?: string | null;
}

export interface InvoiceBalance {
  totalAmount: number;
  
  paidAmount: number;
  
  outstandingAmount: number;
  hasRefund: boolean;
  status: InvoiceStatus;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly paymentsRepository: Repository<Payment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly staffNotificationsService: StaffNotificationsService,
  ) {}

  async record(params: RecordPaymentParams, manager?: EntityManager): Promise<Payment> {
    return this.run(manager, async (em) => {
      if (!Number.isFinite(params.amount) || params.amount <= 0) {
        throw new BadRequestException('So tien thanh toan phai lon hon 0');
      }

      await this.lock(em, params.invoiceId);
      const invoice = await this.loadInvoice(em, params.invoiceId);

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new ConflictException('Hoa don da bi huy, khong ghi nhan thanh toan duoc');
      }
      if (invoice.status === InvoiceStatus.REFUNDED) {
        throw new ConflictException('Hoa don da hoan tien, khong ghi nhan thanh toan duoc');
      }

      const status = params.status ?? PaymentStatus.SUCCESS;

      if (SETTLED_PAYMENT_STATUSES.includes(status)) {
        const paidAmount = await this.paidAmountOf(em, invoice.id);
        const remaining = invoice.totalAmount - paidAmount;
        if (params.amount > remaining) {
          throw new ConflictException(
            `Tra du: hoa don ${invoice.invoiceCode} con phai thu ${remaining}, dang tra ${params.amount}`,
          );
        }
      }

      const payment = await em.save(
        em.create(Payment, {
          invoiceId: invoice.id,
          amount: params.amount,
          method: params.method,
          status,
          paidAt: status === PaymentStatus.SUCCESS ? new Date() : null,
          referenceCode: params.referenceCode ?? null,
          receivedByUserId: params.receivedByUserId ?? null,
          note: params.note ?? null,
        }),
      );

      await this.syncStatus(em, invoice.id);

      if (status === PaymentStatus.FAILED) {
        await this.staffNotificationsService.notify(em, {
          type: StaffNotificationType.PAYMENT_FAILED,
          title: 'Thanh toán thất bại',
          body:
            `Hóa đơn ${invoice.invoiceCode}: giao dịch ${params.method} số tiền ` +
            `${params.amount.toLocaleString('vi-VN')} đ không thành công.`,
          link: `/staff/billing/${invoice.id}`,
          branchId: invoice.branchId,

          dedupeKey: `payment-failed:${payment.id}`,
        });
      }

      return payment;
    });
  }

  async refund(
    params: { invoiceId: string; amount: number; method: PaymentMethod } & Omit<
      RecordPaymentParams,
      'invoiceId' | 'amount' | 'method' | 'status'
    >,
    manager?: EntityManager,
  ): Promise<Payment> {
    return this.run(manager, async (em) => {
      if (!Number.isFinite(params.amount) || params.amount <= 0) {
        throw new BadRequestException('So tien hoan phai lon hon 0');
      }

      await this.lock(em, params.invoiceId);
      const invoice = await this.loadInvoice(em, params.invoiceId);

      const paidAmount = await this.paidAmountOf(em, invoice.id);
      if (paidAmount <= 0) {
        throw new ConflictException(
          `Hoa don ${invoice.invoiceCode} chua thu duoc dong nao, khong co gi de hoan`,
        );
      }
      if (params.amount > paidAmount) {
        throw new ConflictException(
          `Hoan vuot so da thu: da thu ${paidAmount}, dang hoan ${params.amount}`,
        );
      }

      const payment = await em.save(
        em.create(Payment, {
          invoiceId: invoice.id,
          amount: -params.amount,
          method: params.method,
          status: PaymentStatus.REFUNDED,
          paidAt: new Date(),
          referenceCode: params.referenceCode ?? null,
          receivedByUserId: params.receivedByUserId ?? null,
          note: params.note ?? null,
        }),
      );

      await this.syncStatus(em, invoice.id);
      return payment;
    });
  }

  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { invoiceId },
      order: { createdAt: 'ASC' },
    });
  }

  async findAll(query: QueryPaymentsDto): Promise<PaginatedResultDto<Payment>> {
    const qb = this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice');

    if (query.invoiceId) {
      qb.andWhere('payment.invoiceId = :invoiceId', { invoiceId: query.invoiceId });
    }

    if (query.branchId) {
      qb.andWhere('invoice.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.method) qb.andWhere('payment.method = :method', { method: query.method });
    if (query.status) qb.andWhere('payment.status = :status', { status: query.status });
    if (query.receivedByUserId) {
      qb.andWhere('payment.receivedByUserId = :receivedByUserId', {
        receivedByUserId: query.receivedByUserId,
      });
    }
    if (query.fromDate) {
      qb.andWhere('payment.paidAt >= :fromDate', {
        fromDate: new Date(`${query.fromDate}T00:00:00`),
      });
    }
    if (query.toDate) {
      qb.andWhere('payment.paidAt <= :toDate', {
        toDate: new Date(`${query.toDate}T23:59:59.999`),
      });
    }

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`payment.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
      relations: ['invoice'],
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async balanceOf(invoiceId: string, manager?: EntityManager): Promise<InvoiceBalance> {
    const em = manager ?? this.dataSource.manager;
    const invoice = await this.loadInvoice(em, invoiceId);
    const paidAmount = await this.paidAmountOf(em, invoiceId);

    return {
      totalAmount: invoice.totalAmount,
      paidAmount,
      outstandingAmount: Math.max(0, invoice.totalAmount - paidAmount),
      hasRefund: await this.hasRefund(em, invoiceId),
      status: invoice.status,
    };
  }

  async syncStatus(em: EntityManager, invoiceId: string): Promise<InvoiceStatus> {
    const invoice = await this.loadInvoice(em, invoiceId);
    const paidAmount = await this.paidAmountOf(em, invoiceId);
    const hasRefund = await this.hasRefund(em, invoiceId);

    const status = deriveInvoiceStatus({
      totalAmount: invoice.totalAmount,
      netPaidAmount: paidAmount,
      hasRefund,
      isCancelled: invoice.status === InvoiceStatus.CANCELLED,
    });

    const latest = await em.findOne(Payment, {
      where: { invoiceId, status: PaymentStatus.SUCCESS },
      order: { paidAt: 'DESC', createdAt: 'DESC' },
    });

    await em.update(
      Invoice,
      { id: invoiceId },
      {
        status,
        paid: status === InvoiceStatus.PAID,
        paidAt: status === InvoiceStatus.PAID ? (latest?.paidAt ?? new Date()) : null,
        paymentMethod: latest?.method ?? null,
      },
    );

    return status;
  }

  private async paidAmountOf(em: EntityManager, invoiceId: string): Promise<number> {
    const row = await em
      .createQueryBuilder(Payment, 'payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'total')
      .where('payment.invoice_id = :invoiceId', { invoiceId })
      .andWhere('payment.status IN (:...statuses)', { statuses: SETTLED_PAYMENT_STATUSES })
      .andWhere('payment.deleted_at IS NULL')
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async hasRefund(em: EntityManager, invoiceId: string): Promise<boolean> {
    const count = await em.count(Payment, {
      where: { invoiceId, status: PaymentStatus.REFUNDED },
    });
    return count > 0;
  }

  private async loadInvoice(em: EntityManager, invoiceId: string): Promise<Invoice> {
    const invoice = await em.findOne(Invoice, { where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  private lock(em: EntityManager, invoiceId: string): Promise<unknown> {
    return em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`invoice:${invoiceId}`]);
  }

  private run<T>(
    manager: EntityManager | undefined,
    work: (em: EntityManager) => Promise<T>,
  ): Promise<T> {
    return manager ? work(manager) : this.dataSource.transaction(work);
  }
}
