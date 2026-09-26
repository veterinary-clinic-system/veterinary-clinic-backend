import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Payment } from '@/modules/billing/domain/entities/payment.entity';
import { InvoiceStatus } from '@/shared/common/enums/invoice-status.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PaymentStatus } from '@/shared/common/enums/payment-status.enum';
import { PaymentsService } from './payments.service';

function amountQuery(total: string) {
  const builder = {
    select: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue({ total }),
  };
  builder.select.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  return builder;
}

function createHarness(paidAmounts: string[]) {
  const invoice = {
    id: 'invoice-1',
    invoiceCode: 'HD000001',
    totalAmount: 100_000,
    status: InvoiceStatus.PENDING,
    branchId: 'branch-1',
  } as Invoice;
  const builders = paidAmounts.map(amountQuery);
  const manager = {
    query: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === Invoice) return invoice;
      if (entity === Payment) return null;
      return null;
    }),
    createQueryBuilder: jest.fn(() => builders.shift()),
    create: jest.fn((_entity, value) => value),
    save: jest.fn(async (value) => ({ id: 'payment-1', ...value })),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue(undefined),
  } as unknown as EntityManager;
  const dataSource = {
    manager,
    transaction: jest.fn((work: (em: EntityManager) => Promise<unknown>) => work(manager)),
  } as unknown as DataSource;
  const service = new PaymentsService({} as Repository<Payment>, dataSource, {
    notify: jest.fn(),
  } as never);
  return { service, manager: manager as unknown as jest.Mocked<EntityManager> };
}

describe('PaymentsService money invariants', () => {
  it('locks the invoice and rejects an overpayment before saving', async () => {
    const { service, manager } = createHarness(['80000']);

    await expect(
      service.record({
        invoiceId: 'invoice-1',
        amount: 30_000,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'invoice:invoice-1',
    ]);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects a refund larger than the net amount collected', async () => {
    const { service, manager } = createHarness(['80000']);

    await expect(
      service.refund({
        invoiceId: 'invoice-1',
        amount: 90_000,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(manager.save).not.toHaveBeenCalled();
  });

  it('records a partial payment and synchronizes the invoice status in one transaction', async () => {
    const { service, manager } = createHarness(['0', '40000']);

    await service.record({
      invoiceId: 'invoice-1',
      amount: 40_000,
      method: PaymentMethod.BANK_TRANSFER,
    });

    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'invoice-1',
        amount: 40_000,
        status: PaymentStatus.SUCCESS,
      }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      Invoice,
      { id: 'invoice-1' },
      expect.objectContaining({ status: InvoiceStatus.PARTIALLY_PAID, paid: false }),
    );
  });
});
