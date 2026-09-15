import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Payment } from '@/modules/billing/domain/entities/payment.entity';
import { SepayTransaction } from '@/modules/billing/domain/entities/sepay-transaction.entity';
import { InvoiceStatus } from '@/shared/common/enums/invoice-status.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PaymentStatus } from '@/shared/common/enums/payment-status.enum';
import { SepayReconciliationStatus } from '@/shared/common/enums/sepay-reconciliation-status.enum';
import { PaymentsService } from '@/modules/billing/application/payments.service';
import { PaymentRealtimeService } from '@/modules/billing/application/payment-realtime.service';
import { SepayWebhookDto } from '@/modules/billing/presentation/dto/sepay-webhook.dto';
import { StaffNotificationsService } from '@/modules/notification/application';
import { StaffNotificationType } from '@/shared/common/enums/staff-notification.enum';

export interface SepayQrTicket {
  paymentId: string;
  invoiceId: string;
  invoiceCode: string;
  amount: number;
  qrImageUrl: string;
  transferContent: string;
  accountNumber: string;
  bankCode: string;
}

export interface SepayWebhookResult {
  matched: boolean;
  paymentId?: string;
  reconciliationId: string;
}

@Injectable()
export class SepayService {
  private readonly logger = new Logger(SepayService.name);

  constructor(
    @InjectRepository(Invoice) private readonly invoicesRepository: Repository<Invoice>,
    @InjectRepository(Payment) private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(SepayTransaction)
    private readonly sepayTransactionsRepository: Repository<SepayTransaction>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly paymentsService: PaymentsService,
    private readonly realtimeService: PaymentRealtimeService,
    private readonly staffNotificationsService: StaffNotificationsService,
    private readonly configService: ConfigService,
  ) {}

  private requireConfig(): {
    accountNumber: string;
    bankCode: string;
    qrEndpoint: string;
    prefix: string;
  } {
    const accountNumber = this.configService.get<string>('payment.sepay.accountNumber');
    const bankCode = this.configService.get<string>('payment.sepay.bankCode');
    const qrEndpoint = this.configService.get<string>('payment.sepay.qrEndpoint')!;
    const prefix = this.configService.get<string>('payment.sepay.transferPrefix')!;
    if (!accountNumber || !bankCode) {
      throw new InternalServerErrorException(
        'Chưa cấu hình SEPAY_ACCOUNT_NUMBER / SEPAY_BANK_CODE - không thể tạo mã QR SePay',
      );
    }
    return { accountNumber, bankCode, qrEndpoint, prefix };
  }

  transferContentFor(invoiceCode: string): string {
    const { prefix } = this.requireConfig();
    return `${prefix}${invoiceCode.replace(/[^a-zA-Z0-9]/g, '')}`.toUpperCase();
  }

  async createQrTicket(invoiceId: string, amount?: number): Promise<SepayQrTicket> {
    const { accountNumber, bankCode, qrEndpoint } = this.requireConfig();
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`invoice:${invoiceId}`]);
      const invoice = await manager.findOne(Invoice, { where: { id: invoiceId } });
      if (!invoice) throw new NotFoundException('Không tìm thấy hóa đơn');
      if (invoice.status === InvoiceStatus.CANCELLED)
        throw new ConflictException('Hóa đơn đã bị hủy');
      if (invoice.status === InvoiceStatus.PAID)
        throw new ConflictException('Hóa đơn đã được thanh toán');

      const balance = await this.paymentsService.balanceOf(invoiceId, manager);
      if (balance.paidAmount > 0) {
        throw new ConflictException('SePay chỉ hỗ trợ hóa đơn chưa có lần thanh toán nào');
      }
      const requested = amount ?? balance.outstandingAmount;
      if (requested <= 0) throw new ConflictException('Hóa đơn không còn số dư phải thu');
      if (requested !== balance.outstandingAmount) {
        throw new BadRequestException(
          'SePay chỉ chấp nhận thanh toán đúng toàn bộ số tiền còn lại',
        );
      }

      const transferContent = this.transferContentFor(invoice.invoiceCode);
      const existing = await manager.findOne(Payment, {
        where: {
          invoiceId,
          status: PaymentStatus.PENDING,
          method: PaymentMethod.QR,
          amount: requested,
          referenceCode: transferContent,
        },
        order: { createdAt: 'DESC' },
      });
      const payment =
        existing ??
        (await this.paymentsService.record(
          {
            invoiceId,
            amount: requested,
            method: PaymentMethod.QR,
            status: PaymentStatus.PENDING,
            referenceCode: transferContent,
            note: 'Chờ chuyển khoản qua SePay',
          },
          manager,
        ));

      const qrImageUrl =
        `${qrEndpoint}?acc=${encodeURIComponent(accountNumber)}` +
        `&bank=${encodeURIComponent(bankCode)}` +
        `&amount=${requested}&des=${encodeURIComponent(transferContent)}&template=compact`;
      return {
        paymentId: payment.id,
        invoiceId,
        invoiceCode: invoice.invoiceCode,
        amount: requested,
        qrImageUrl,
        transferContent,
        accountNumber,
        bankCode,
      };
    });
  }

  assertWebhookAuthorized(authorizationHeader?: string): void {
    const apiKey = this.configService.get<string>('payment.sepay.apiKey');
    if (!apiKey) {
      this.logger.error('SEPAY_API_KEY chưa được cấu hình - từ chối webhook');
      throw new UnauthorizedException('Webhook SePay chưa được cấu hình');
    }
    const provided = authorizationHeader?.replace(/^Apikey\s+/i, '').trim();
    if (!provided || !this.constantTimeEqual(provided, apiKey)) {
      throw new UnauthorizedException('API Key webhook không hợp lệ');
    }
  }

  async handleWebhook(dto: SepayWebhookDto): Promise<SepayWebhookResult> {
    const result = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sepay:${dto.id}`]);
      const duplicate = await manager.findOne(SepayTransaction, {
        where: { providerTransactionId: dto.id },
      });
      if (duplicate) {
        return {
          matched: duplicate.status === SepayReconciliationStatus.MATCHED,
          paymentId: duplicate.paymentId ?? undefined,
          reconciliationId: duplicate.id,
        };
      }

      const transaction = manager.create(SepayTransaction, {
        providerTransactionId: dto.id,
        gateway: dto.gateway ?? null,
        bankReference: dto.referenceCode ?? null,
        accountNumber: dto.accountNumber ?? null,
        transactionDate: this.parseTransactionDate(dto.transactionDate),
        receivedAt: new Date(),
        transferAmount: dto.transferAmount,
        content: dto.content ?? dto.description ?? null,
        status: SepayReconciliationStatus.NEEDS_REVIEW,
        reviewReason: null,
        invoiceId: null,
        paymentId: null,
        reviewedByUserId: null,
        reviewedAt: null,
        rawPayload: { ...dto },
      });

      if (dto.transferType !== 'in') {
        transaction.status = SepayReconciliationStatus.IGNORED;
        transaction.reviewReason = 'OUTGOING_TRANSACTION';
        const saved = await manager.save(transaction);
        return { matched: false, reconciliationId: saved.id };
      }

      const configuredAccount = this.normalize(this.requireConfig().accountNumber);
      if (dto.accountNumber && this.normalize(dto.accountNumber) !== configuredAccount) {
        return this.saveForReview(manager, transaction, 'ACCOUNT_MISMATCH');
      }

      const normalizedContent = this.normalize(`${dto.content ?? ''} ${dto.code ?? ''}`);
      if (!normalizedContent)
        return this.saveForReview(manager, transaction, 'MISSING_TRANSFER_CONTENT');

      const pendingTickets = await manager.find(Payment, {
        where: { status: PaymentStatus.PENDING, method: PaymentMethod.QR },
        relations: ['invoice'],
      });
      const candidates = pendingTickets.filter(
        (ticket) =>
          !!ticket.referenceCode &&
          normalizedContent.includes(this.normalize(ticket.referenceCode)),
      );
      if (candidates.length === 0)
        return this.saveForReview(manager, transaction, 'INVOICE_NOT_FOUND');
      if (candidates.length > 1)
        return this.saveForReview(manager, transaction, 'AMBIGUOUS_INVOICE_CODE');

      const pending = candidates[0];
      transaction.invoiceId = pending.invoiceId;
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `invoice:${pending.invoiceId}`,
      ]);
      const balance = await this.paymentsService.balanceOf(pending.invoiceId, manager);
      if (
        dto.transferAmount !== pending.amount ||
        dto.transferAmount !== balance.outstandingAmount
      ) {
        return this.saveForReview(manager, transaction, 'AMOUNT_MISMATCH');
      }

      const paidAt = this.parseTransactionDate(dto.transactionDate) ?? new Date();
      await manager.update(Payment, pending.id, {
        status: PaymentStatus.SUCCESS,
        paidAt,
        referenceCode: `sepay:${dto.id}`,
        note: `SePay ${dto.gateway ?? ''} · ${dto.referenceCode ?? ''}`.trim(),
      });
      await this.paymentsService.syncStatus(manager, pending.invoiceId);
      transaction.status = SepayReconciliationStatus.MATCHED;
      transaction.reviewReason = null;
      transaction.paymentId = pending.id;
      const saved = await manager.save(transaction);
      await this.notifyPaymentReceived(manager, pending.invoice, pending.id, dto.transferAmount);
      return { matched: true, paymentId: pending.id, reconciliationId: saved.id };
    });

    if (result.matched && result.paymentId) {
      const payment = await this.paymentsRepository.findOne({ where: { id: result.paymentId } });
      if (payment)
        this.realtimeService.publish({
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          status: payment.status,
          paidAt: payment.paidAt,
        });
    }
    return result;
  }

  async listPendingReconciliations(): Promise<SepayTransaction[]> {
    return this.sepayTransactionsRepository.find({
      where: { status: SepayReconciliationStatus.NEEDS_REVIEW },
      relations: ['invoice'],
      order: { receivedAt: 'DESC' },
      take: 100,
    });
  }

  async reconcile(id: string, invoiceCode: string, userId: string): Promise<SepayTransaction> {
    const result = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sepay-review:${id}`]);
      const transaction = await manager.findOne(SepayTransaction, { where: { id } });
      if (!transaction) throw new NotFoundException('Không tìm thấy giao dịch SePay');
      if (transaction.status !== SepayReconciliationStatus.NEEDS_REVIEW) {
        throw new ConflictException('Giao dịch này đã được xử lý');
      }
      const invoice = await manager.findOne(Invoice, {
        where: { invoiceCode: invoiceCode.toUpperCase() },
      });
      if (!invoice) throw new NotFoundException('Không tìm thấy hóa đơn');
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`invoice:${invoice.id}`]);
      const balance = await this.paymentsService.balanceOf(invoice.id, manager);
      if (balance.paidAmount > 0) {
        throw new ConflictException('Hóa đơn đã có lần thanh toán trước đó');
      }
      if (transaction.transferAmount !== balance.outstandingAmount) {
        throw new ConflictException(
          `Số tiền giao dịch (${transaction.transferAmount}) không bằng số còn phải thu (${balance.outstandingAmount})`,
        );
      }

      const pending = await manager.findOne(Payment, {
        where: { invoiceId: invoice.id, status: PaymentStatus.PENDING, method: PaymentMethod.QR },
        order: { createdAt: 'DESC' },
      });
      const payment = pending
        ? await this.settlePending(manager, pending, transaction)
        : await this.paymentsService.record(
            {
              invoiceId: invoice.id,
              amount: transaction.transferAmount,
              method: PaymentMethod.QR,
              status: PaymentStatus.SUCCESS,
              referenceCode: `sepay:${transaction.providerTransactionId}`,
              note: `Đối soát thủ công bởi ${userId}`,
            },
            manager,
          );
      transaction.status = SepayReconciliationStatus.MATCHED;
      transaction.reviewReason = null;
      transaction.invoiceId = invoice.id;
      transaction.paymentId = payment.id;
      transaction.reviewedByUserId = userId;
      transaction.reviewedAt = new Date();
      const saved = await manager.save(transaction);
      await this.notifyPaymentReceived(manager, invoice, payment.id, payment.amount);
      return { transaction: saved, payment };
    });
    this.realtimeService.publish({
      paymentId: result.payment.id,
      invoiceId: result.payment.invoiceId,
      status: result.payment.status,
      paidAt: result.payment.paidAt,
    });
    return result.transaction;
  }

  async getTicketStatus(
    paymentId: string,
  ): Promise<{ status: PaymentStatus; paidAt: Date | null }> {
    const payment = await this.paymentsRepository.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Không tìm thấy giao dịch');
    return { status: payment.status, paidAt: payment.paidAt };
  }

  async cancelTicket(paymentId: string): Promise<void> {
    const payment = await this.paymentsRepository.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Không tìm thấy giao dịch');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Chỉ hủy được giao dịch đang chờ chuyển khoản');
    }
    await this.paymentsRepository.update(paymentId, { status: PaymentStatus.FAILED });
    this.realtimeService.publish({
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      status: PaymentStatus.FAILED,
      paidAt: null,
    });
  }

  private async saveForReview(
    manager: EntityManager,
    transaction: SepayTransaction,
    reason: string,
  ): Promise<SepayWebhookResult> {
    transaction.status = SepayReconciliationStatus.NEEDS_REVIEW;
    transaction.reviewReason = reason;
    const saved = await manager.save(transaction);
    this.logger.warn(`SePay ${transaction.providerTransactionId} cần đối soát: ${reason}`);
    return { matched: false, reconciliationId: saved.id };
  }

  private async settlePending(
    manager: EntityManager,
    payment: Payment,
    transaction: SepayTransaction,
  ): Promise<Payment> {
    payment.status = PaymentStatus.SUCCESS;
    payment.amount = transaction.transferAmount;
    payment.paidAt = transaction.transactionDate ?? new Date();
    payment.referenceCode = `sepay:${transaction.providerTransactionId}`;
    payment.note = `SePay đối soát thủ công · ${transaction.bankReference ?? ''}`.trim();
    const saved = await manager.save(payment);
    await this.paymentsService.syncStatus(manager, payment.invoiceId);
    return saved;
  }

  private async notifyPaymentReceived(
    manager: EntityManager,
    invoice: Invoice,
    paymentId: string,
    amount: number,
  ): Promise<void> {
    await this.staffNotificationsService.notify(manager, {
      type: StaffNotificationType.PAYMENT_RECEIVED,
      title: 'Đã nhận thanh toán SePay',
      body: `Hóa đơn ${invoice.invoiceCode}: đã nhận ${amount.toLocaleString('vi-VN')} đ.`,
      link: `/staff/billing/${invoice.id}`,
      branchId: invoice.branchId,
      dedupeKey: `payment-received:${paymentId}`,
    });
  }

  private constantTimeEqual(left: string, right: string): boolean {
    const leftHash = createHash('sha256').update(left).digest();
    const rightHash = createHash('sha256').update(right).digest();
    return timingSafeEqual(leftHash, rightHash);
  }

  private normalize(value: string): string {
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  private parseTransactionDate(value?: string): Date | null {
    if (!value) return null;
    const normalized = value.includes('T') ? value : value.replace(' ', 'T') + '+07:00';
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
