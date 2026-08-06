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

/** Cot duoc phep sap xep - chan `?sortBy=` di thang vao SQL. */
const SORTABLE_COLUMNS = new Set(['createdAt', 'paidAt', 'amount']);

/** Mot lan ghi nhan tien vao hoa don. */
export interface RecordPaymentParams {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  /** Mac dinh `SUCCESS` - tien da o trong ket. `PENDING` danh cho cong thanh toan online. */
  status?: PaymentStatus;
  referenceCode?: string | null;
  receivedByUserId?: string | null;
  note?: string | null;
}

/** So tien cua mot hoa don, tinh tu bang `payments`. */
export interface InvoiceBalance {
  totalAmount: number;
  /** Tong cac dong da chot (`SUCCESS` + `REFUNDED`) - da tru phan hoan lai. */
  paidAmount: number;
  /** `totalAmount - paidAmount`, khong bao gio am. */
  outstandingAmount: number;
  hasRefund: boolean;
  status: InvoiceStatus;
}

/**
 * =====================================================================================
 * MOI THAY DOI TIEN CUA MOT HOA DON PHAI DI QUA SERVICE NAY.
 *
 * Cung mot ly le voi "luat so mot cua kho" o `InventoryService`: `invoices.status`,
 * `invoices.paid`, `invoices.paid_at` va `invoices.payment_method` deu la BAN CACHE cua
 * bang `payments`. Chung chi dung neu duoc tinh lai trong CUNG transaction voi dong tien
 * vua ghi - mot cho ghi tat la mot hoa don bao "da thanh toan" ma khong co dong tien nao
 * dung sau, va khong ai phat hien ra cho toi luc doi soat cuoi thang.
 *
 * Ba bao dam:
 *   1. Transaction + `pg_advisory_xact_lock` theo `invoiceId` - hai quay cung thu tien
 *      mot hoa don khong bao gio cung vuot qua duoc phep kiem tra "tra du".
 *   2. Moi lan thu/hoan sinh dung mot dong `payments` bat bien - khong sua dong cu.
 *   3. `SUM(payments.amount) FILTER (SUCCESS, REFUNDED)` luon khop trang thai hoa don.
 *
 * Ham nghiep vu nhan `manager` tuy chon de POS (P8-T5) goi duoc trong transaction cua no.
 * =====================================================================================
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly paymentsRepository: Repository<Payment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly staffNotificationsService: StaffNotificationsService,
  ) {}

  /**
   * Ghi nhan mot lan thu tien.
   *
   * TRA DU BI CHAN (409) chu khong lam tron xuong: neu khach dua thua thi phan thua la
   * tien thoi lai, khong phai doanh thu. Cho phep ghi vuot nghia la bao cao doanh thu
   * cua P10 se cong ca tien thoi.
   */
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

      // Chi cac dong DA CHOT moi chiem cho: mot lan tra dang `PENDING` o cong thanh toan
      // chua chac ve, khoa cho no thi khach khong tra duoc bang cach khac.
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

      // Thanh toan that bai -> bao cho le tan va quan ly (muc 18 SRS, P10-T5). Day la
      // truong hop DUY NHAT trong ham nay can nguoi xu ly: mot lan `SUCCESS` khong can
      // ai lam gi, con `FAILED` nghia la khach dang dung o quay voi mot hoa don chua
      // dong duoc - va man hinh POS thi da chuyen sang khach ke tiep.
      if (status === PaymentStatus.FAILED) {
        await this.staffNotificationsService.notify(em, {
          type: StaffNotificationType.PAYMENT_FAILED,
          title: 'Thanh toán thất bại',
          body:
            `Hóa đơn ${invoice.invoiceCode}: giao dịch ${params.method} số tiền ` +
            `${params.amount.toLocaleString('vi-VN')} đ không thành công.`,
          link: `/staff/billing/${invoice.id}`,
          branchId: invoice.branchId,
          // Khoa theo dong thanh toan chu khong theo hoa don: mot hoa don co the that
          // bai nhieu lan (thu lai the khac), va moi lan la mot viec phai xu ly rieng.
          dedupeKey: `payment-failed:${payment.id}`,
        });
      }

      return payment;
    });
  }

  /**
   * Ghi mot dong HOAN TIEN (P8-T3). So tien truyen vao la so DUONG, dong luu se la am.
   *
   * Khong tu quyet dinh hoan bao nhieu: nguoi goi (`BillingService.refund`) biet dang
   * hoan toan bo hay mot phan, va con phai hoan hang ve kho trong cung transaction.
   */
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

  /** Cac lan tra cua mot hoa don, cu nhat truoc - dung thu tu doc tren man hinh hoa don. */
  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { invoiceId },
      order: { createdAt: 'ASC' },
    });
  }

  /** Danh sach thanh toan co phan trang - man hinh doi soat cuoi ca (P8-T7). */
  async findAll(query: QueryPaymentsDto): Promise<PaginatedResultDto<Payment>> {
    const qb = this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice');

    if (query.invoiceId) {
      qb.andWhere('payment.invoiceId = :invoiceId', { invoiceId: query.invoiceId });
    }
    // Chi nhanh nam tren HOA DON, khong tren lan tra: tien duoc thu o dau thi hoa don da
    // ghi chi nhanh do, va nhan doi cot se tao ra hai nguon su that co the lech nhau.
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

  /** So tien cua mot hoa don, doc tai thoi diem goi. */
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

  /**
   * Tinh lai trang thai hoa don tu bang `payments` va ghi vao ban cache.
   *
   * PHAI goi trong cung transaction voi moi thay doi cua `payments`. Ba cot cu
   * (`paid`/`paid_at`/`payment_method`) cung duoc cap nhat o day: chung la ban tom tat
   * cua lan tra gan nhat, va bao cao doanh thu hien tai van doc `paid_at`.
   */
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

  // ------------------------------------------------------------------ Ben trong

  /**
   * Tong cac dong DA CHOT. `SUCCESS` cong vao, `REFUNDED` (so am) tru ra - xem
   * `SETTLED_PAYMENT_STATUSES`.
   */
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

  /**
   * Khoa theo hoa don trong pham vi transaction - cung mau voi
   * `BillingService.generateForAppointment` va `InventoryService.lock`.
   */
  private lock(em: EntityManager, invoiceId: string): Promise<unknown> {
    return em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`invoice:${invoiceId}`]);
  }

  /** Chay trong transaction cua nguoi goi neu co, khong thi tu mo mot cai. */
  private run<T>(
    manager: EntityManager | undefined,
    work: (em: EntityManager) => Promise<T>,
  ): Promise<T> {
    return manager ? work(manager) : this.dataSource.transaction(work);
  }
}
