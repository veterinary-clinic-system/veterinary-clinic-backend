import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Diagnosis } from '@/modules/clinical/domain/entities/diagnosis.entity';
import { PreScreeningResult } from '@/modules/triage/domain/entities/pre-screening-result.entity';
import { ReportsService } from './reports.service';

describe('ReportsService revenue ledger', () => {
  const query = jest.fn();
  const emptyRepository = {} as Repository<never>;
  const service = new ReportsService(
    { query } as unknown as DataSource,
    emptyRepository as unknown as Repository<Diagnosis>,
    emptyRepository as unknown as Repository<PreScreeningResult>,
  );

  beforeEach(() => query.mockReset());

  it('groups net payment amounts in the clinic timezone', async () => {
    query.mockResolvedValue([{ period: '2026-09-01', totalRevenue: '70000', invoiceCount: '2' }]);

    await expect(
      service.getRevenue({ from: '2026-09-01', to: '2026-09-30', groupBy: 'day' }),
    ).resolves.toEqual([{ period: '2026-09-01', totalRevenue: 70000, invoiceCount: 2 }]);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('p."paid_at" AT TIME ZONE $4'), [
      '2026-09-01',
      '2026-09-30',
      null,
      'Asia/Bangkok',
      null,
      null,
    ]);
    expect(query.mock.calls[0][0]).toContain("p.\"status\" IN ('SUCCESS', 'REFUNDED')");
  });

  it('allocates net payments to services and sums actual quantity', async () => {
    query.mockResolvedValue([
      { serviceName: 'Khám tổng quát', totalRevenue: '125000.5', count: '3' },
    ]);

    await expect(
      service.getRevenueByService({ from: '2026-09-01', to: '2026-09-30' }),
    ).resolves.toEqual([{ serviceName: 'Khám tổng quát', totalRevenue: 125000.5, count: 3 }]);

    expect(query.mock.calls[0][0]).toContain('NULLIF(g."gross", 0)');
    expect(query.mock.calls[0][0]).toContain('SUM(ii."quantity")');
  });

  it('rejects an inverted range before querying the ledger', async () => {
    await expect(
      service.getRevenue({ from: '2026-09-30', to: '2026-09-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
});
