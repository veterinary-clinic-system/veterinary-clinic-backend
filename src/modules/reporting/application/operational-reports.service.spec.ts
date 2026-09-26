import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { OperationalReportsService } from './operational-reports.service';

describe('OperationalReportsService', () => {
  const query = jest.fn();
  const service = new OperationalReportsService({ query } as unknown as DataSource);

  beforeEach(() => query.mockReset());

  it('forwards every sales filter to the database query', async () => {
    query.mockResolvedValue([]);

    await service.getSalesReport({
      from: '2026-09-01',
      to: '2026-09-30',
      branchId: '8d763f86-c172-4fc3-9c82-6e8294d4e98d',
      paymentMethod: PaymentMethod.CASH,
      employeeUserId: '37fc4767-3f24-4aaf-b846-36cf5b29e16a',
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('filtered_payment'), [
      '2026-09-01',
      '2026-09-30',
      '8d763f86-c172-4fc3-9c82-6e8294d4e98d',
      PaymentMethod.CASH,
      '37fc4767-3f24-4aaf-b846-36cf5b29e16a',
      'Asia/Bangkok',
    ]);
  });

  it('rejects an inverted date range before querying', async () => {
    await expect(
      service.getSalesReport({ from: '2026-09-30', to: '2026-09-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('normalizes numeric revenue summary values', async () => {
    query
      .mockResolvedValueOnce([
        { totalRevenue: '120000', totalPaid: '150000', totalRefunded: '30000', invoiceCount: '4' },
      ])
      .mockResolvedValueOnce([{ totalUnpaid: '45000', unpaidInvoiceCount: '2' }]);

    await expect(
      service.getRevenueSummary({ from: '2026-09-01', to: '2026-09-30' }),
    ).resolves.toEqual({
      totalRevenue: 120000,
      totalPaid: 150000,
      totalRefunded: 30000,
      totalUnpaid: 45000,
      invoiceCount: 4,
      unpaidInvoiceCount: 2,
    });
  });
});
