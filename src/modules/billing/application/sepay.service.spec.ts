import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InvoiceStatus } from '@/shared/common/enums/invoice-status.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PaymentStatus } from '@/shared/common/enums/payment-status.enum';
import { SepayReconciliationStatus } from '@/shared/common/enums/sepay-reconciliation-status.enum';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Payment } from '@/modules/billing/domain/entities/payment.entity';
import { SepayTransaction } from '@/modules/billing/domain/entities/sepay-transaction.entity';
import { SepayService } from './sepay.service';

const configValues: Record<string, string> = {
  'payment.sepay.accountNumber': '0123456789',
  'payment.sepay.bankCode': 'VCB',
  'payment.sepay.apiKey': 'test-webhook-key',
  'payment.sepay.qrEndpoint': 'https://vietqr.app/img',
  'payment.sepay.transferPrefix': 'VETAI',
};

function createService(overrides: Record<string, unknown> = {}) {
  const invoicesRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 'invoice-1',
      invoiceCode: 'HD000001',
      status: InvoiceStatus.PENDING,
    }),
  };
  const paymentsRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const paymentsService = {
    balanceOf: jest.fn().mockResolvedValue({ outstandingAmount: 100_000 }),
    record: jest.fn(),
    syncStatus: jest.fn(),
  };
  const realtimeService = { publish: jest.fn(), watch: jest.fn() };
  const staffNotificationsService = { notify: jest.fn().mockResolvedValue(1) };
  const configService = { get: jest.fn((key: string) => configValues[key]) };
  const manager = {
    query: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((_entity, value) => value),
    save: jest.fn(async (value) => ({ id: 'reconciliation-1', ...value })),
    update: jest.fn(),
  };
  const dataSource = { transaction: jest.fn((work) => work(manager)) };

  const dependencies = {
    invoicesRepository,
    paymentsRepository,
    sepayTransactionsRepository: { find: jest.fn() },
    dataSource,
    paymentsService,
    realtimeService,
    staffNotificationsService,
    configService,
    manager,
    ...overrides,
  };
  const service = new SepayService(
    dependencies.invoicesRepository as never,
    dependencies.paymentsRepository as never,
    dependencies.sepayTransactionsRepository as never,
    dependencies.dataSource as never,
    dependencies.paymentsService as never,
    dependencies.realtimeService as never,
    dependencies.staffNotificationsService as never,
    dependencies.configService as never,
  );
  return { service, ...dependencies };
}

const webhook = {
  id: '92704',
  gateway: 'Vietcombank',
  transactionDate: '2026-09-15 12:00:00',
  accountNumber: '0123456789',
  code: 'VETAIHD000001',
  content: 'VETAIHD000001 chuyen tien',
  transferType: 'in' as const,
  transferAmount: 100_000,
  referenceCode: 'FT123',
};

describe('SepayService', () => {
  it('rejects an invalid webhook API key', () => {
    const { service } = createService();
    expect(() => service.assertWebhookAuthorized('Apikey wrong-key')).toThrow(
      UnauthorizedException,
    );
    expect(() => service.assertWebhookAuthorized('Apikey test-webhook-key')).not.toThrow();
  });

  it('only creates a QR for the full outstanding amount', async () => {
    const { service, manager } = createService();
    manager.findOne.mockImplementation(async (entity) =>
      entity === Invoice
        ? { id: 'invoice-1', invoiceCode: 'HD000001', status: InvoiceStatus.PENDING }
        : undefined,
    );
    await expect(service.createQrTicket('invoice-1', 50_000)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('puts an amount mismatch into the manual reconciliation queue', async () => {
    const { service, manager } = createService();
    const pending = {
      id: 'payment-1',
      invoiceId: 'invoice-1',
      amount: 100_000,
      method: PaymentMethod.QR,
      status: PaymentStatus.PENDING,
      referenceCode: 'VETAIHD000001',
      invoice: { id: 'invoice-1', invoiceCode: 'HD000001', branchId: 'branch-1' },
    };
    manager.findOne.mockImplementation(async (entity) =>
      entity === SepayTransaction ? null : undefined,
    );
    manager.find.mockResolvedValue([pending]);

    const result = await service.handleWebhook({ ...webhook, transferAmount: 99_000 });

    expect(result.matched).toBe(false);
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SepayReconciliationStatus.NEEDS_REVIEW,
        reviewReason: 'AMOUNT_MISMATCH',
        invoiceId: 'invoice-1',
      }),
    );
  });

  it('settles exactly one pending ticket and publishes a realtime update', async () => {
    const { service, manager, paymentsRepository, paymentsService, realtimeService } =
      createService();
    const invoice = { id: 'invoice-1', invoiceCode: 'HD000001', branchId: 'branch-1' };
    const pending = {
      id: 'payment-1',
      invoiceId: invoice.id,
      amount: 100_000,
      method: PaymentMethod.QR,
      status: PaymentStatus.PENDING,
      referenceCode: 'VETAIHD000001',
      invoice,
    };
    manager.findOne.mockImplementation(async (entity) =>
      entity === SepayTransaction ? null : undefined,
    );
    manager.find.mockResolvedValue([pending]);
    paymentsRepository.findOne.mockResolvedValue({
      ...pending,
      status: PaymentStatus.SUCCESS,
      paidAt: new Date('2026-09-15T05:00:00.000Z'),
    });

    const result = await service.handleWebhook(webhook);

    expect(result.matched).toBe(true);
    expect(manager.update).toHaveBeenCalledWith(
      Payment,
      'payment-1',
      expect.objectContaining({ status: PaymentStatus.SUCCESS, referenceCode: 'sepay:92704' }),
    );
    expect(paymentsService.syncStatus).toHaveBeenCalledWith(manager, 'invoice-1');
    expect(realtimeService.publish).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'payment-1', status: PaymentStatus.SUCCESS }),
    );
  });

  it('returns the existing result when SePay retries the same transaction', async () => {
    const { service, manager } = createService();
    manager.findOne.mockImplementation(async (entity) =>
      entity === SepayTransaction
        ? {
            id: 'reconciliation-1',
            status: SepayReconciliationStatus.MATCHED,
            paymentId: 'payment-1',
          }
        : undefined,
    );

    const result = await service.handleWebhook(webhook);

    expect(result).toEqual({
      matched: true,
      paymentId: 'payment-1',
      reconciliationId: 'reconciliation-1',
    });
    expect(manager.find).not.toHaveBeenCalled();
  });
});
