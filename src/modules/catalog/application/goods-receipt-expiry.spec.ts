import { BadRequestException } from '@nestjs/common';
import { GoodsReceiptsService } from './goods-receipts.service';

describe('GoodsReceiptsService - khong nhap lo da het han', () => {
  const service = new GoodsReceiptsService(
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
  );
  const assertNotExpired = (dto: unknown) =>
    (
      service as never as { assertNotExpiredOnArrival: (d: unknown) => void }
    ).assertNotExpiredOnArrival(dto);

  const line = (expiryDate?: string) => ({
    itemId: 'i1',
    quantity: 1,
    unitCost: 1000,
    batchNo: 'LOT-1',
    expiryDate,
  });

  it('tu choi lo het han truoc hoac dung ngay nhan', () => {
    expect(() =>
      assertNotExpired({ receivedDate: '2026-10-16', items: [line('2025-01-01')] }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertNotExpired({ receivedDate: '2026-10-16', items: [line('2026-10-16')] }),
    ).toThrow(BadRequestException);
  });

  it('chap nhan lo con han va lo khong co han dung', () => {
    expect(() =>
      assertNotExpired({
        receivedDate: '2026-10-16',
        items: [line('2026-10-17'), line(undefined)],
      }),
    ).not.toThrow();
  });
});
