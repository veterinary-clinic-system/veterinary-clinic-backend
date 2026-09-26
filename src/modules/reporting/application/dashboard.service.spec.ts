import { DataSource } from 'typeorm';
import type Redis from 'ioredis';
import { DashboardService } from './dashboard.service';

describe('DashboardService reporting timezone', () => {
  it('uses the clinic timezone for every date-based dashboard query', async () => {
    const query = jest.fn((sql: string, params?: unknown[]) => {
      void params;
      return Promise.resolve(sql.includes('AS "revenueToday"') ? [{}] : []);
    });
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    } as unknown as Redis;
    const service = new DashboardService({ query } as unknown as DataSource, redis);

    const result = await service.getDashboard();

    expect(result.kpis).toHaveLength(8);
    expect(result.charts).toHaveLength(8);
    expect(query).toHaveBeenCalledTimes(9);
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain('AT TIME ZONE');
      expect(params ?? []).toContain('Asia/Bangkok');
    }
  });
});
