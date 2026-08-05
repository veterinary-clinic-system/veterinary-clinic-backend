import { InventoryTransactionType } from '@/shared/common/enums/inventory-transaction-type.enum';
import {
  AllocatableBatch,
  InsufficientStockError,
  allocateFefo,
  availableQuantity,
  isValidSign,
  planLedgerLines,
} from './inventory-allocation.util';

/**
 * Test cho phan tinh toan thuan cua nghiep vu kho - acceptance cua P6-T2 va P6-T3.
 *
 * KHONG dung CSDL: FEFO va ton luy ke la ham thuan. Phan con lai cua `InventoryService`
 * (transaction, advisory lock, CHECK o CSDL) can Postgres that moi kiem chung duoc - do
 * la viec cua smoke test bang API that, khong phai cua file nay.
 *
 * `describe('bat bien so cai')` ben duoi la test ma P6-T2 goi dich danh: "SUM(quantityChange)
 * cua mot item = inventory_quantity hien tai". No bat moi loi lech kho ve sau, nen dung
 * xoa hay noi long no khi refactor.
 */
describe('inventory-allocation.util', () => {
  const TODAY = '2026-08-05';

  function batch(over: Partial<AllocatableBatch> & { id: string }): AllocatableBatch {
    return {
      batchNo: `LO-${over.id}`,
      expiryDate: null,
      quantity: 10,
      receivedAt: new Date('2026-01-01T00:00:00Z'),
      ...over,
    };
  }

  describe('allocateFefo', () => {
    it('lay het lo het han som nhat truoc roi moi sang lo sau', () => {
      // Acceptance P6-T3: lo HSD 01/2027 (10) va 06/2027 (10), xuat 15.
      const batches = [
        batch({ id: 'b-06', expiryDate: '2027-06-30', quantity: 10 }),
        batch({ id: 'b-01', expiryDate: '2027-01-31', quantity: 10 }),
      ];

      expect(allocateFefo(batches, 15, TODAY)).toEqual([
        { batchId: 'b-01', batchNo: 'LO-b-01', quantity: 10 },
        { batchId: 'b-06', batchNo: 'LO-b-06', quantity: 5 },
      ]);
    });

    it('bo qua lo da het han - BR-11', () => {
      const batches = [
        batch({ id: 'het-han', expiryDate: '2026-08-04', quantity: 100 }),
        batch({ id: 'con-han', expiryDate: '2027-01-31', quantity: 10 }),
      ];

      expect(allocateFefo(batches, 10, TODAY)).toEqual([
        { batchId: 'con-han', batchNo: 'LO-con-han', quantity: 10 },
      ]);
    });

    it('lo het han DUNG hom nay van dung duoc', () => {
      const batches = [batch({ id: 'hom-nay', expiryDate: TODAY, quantity: 5 })];

      expect(allocateFefo(batches, 5, TODAY)).toHaveLength(1);
    });

    it('lo khong han dung duoc xep sau lo co han', () => {
      const batches = [
        batch({ id: 'khong-han', expiryDate: null, quantity: 10 }),
        batch({ id: 'co-han', expiryDate: '2030-12-31', quantity: 10 }),
      ];

      expect(allocateFefo(batches, 12, TODAY).map((a) => a.batchId)).toEqual([
        'co-han',
        'khong-han',
      ]);
    });

    it('cung han thi lo nhap truoc di truoc', () => {
      const batches = [
        batch({
          id: 'moi',
          expiryDate: '2027-01-31',
          quantity: 10,
          receivedAt: new Date('2026-07-01T00:00:00Z'),
        }),
        batch({
          id: 'cu',
          expiryDate: '2027-01-31',
          quantity: 10,
          receivedAt: new Date('2026-02-01T00:00:00Z'),
        }),
      ];

      expect(allocateFefo(batches, 11, TODAY).map((a) => a.batchId)).toEqual(['cu', 'moi']);
    });

    it('thieu hang thi nem loi va KHONG phan bo mot phan nao', () => {
      // Acceptance P6-T3: "xuat 10 khi ton 8 -> 409, khong thay doi gi". Kiem tra o day
      // la ham nem truoc khi kip chia - neu no tra ve mot phan roi moi bao thieu thi
      // service se da tru mat vai lo.
      const batches = [batch({ id: 'b1', quantity: 8 })];

      expect(() => allocateFefo(batches, 10, TODAY)).toThrow(InsufficientStockError);
    });

    it('lo het han khong duoc tinh vao so kha dung khi bao thieu', () => {
      const batches = [
        batch({ id: 'het-han', expiryDate: '2020-01-01', quantity: 100 }),
        batch({ id: 'con-han', quantity: 3 }),
      ];

      try {
        allocateFefo(batches, 10, TODAY);
        fail('phai nem InsufficientStockError');
      } catch (err) {
        expect(err).toBeInstanceOf(InsufficientStockError);
        expect((err as InsufficientStockError).available).toBe(3);
      }
    });

    it('tu choi so luong khong phai so nguyen duong', () => {
      const batches = [batch({ id: 'b1', quantity: 100 })];

      expect(() => allocateFefo(batches, 0, TODAY)).toThrow(RangeError);
      expect(() => allocateFefo(batches, -5, TODAY)).toThrow(RangeError);
      expect(() => allocateFefo(batches, 1.5, TODAY)).toThrow(RangeError);
    });
  });

  describe('availableQuantity', () => {
    it('cong don lo con han va bo lo het han - BR-11', () => {
      const batches = [
        batch({ id: 'a', expiryDate: '2027-01-31', quantity: 7 }),
        batch({ id: 'b', expiryDate: '2026-08-04', quantity: 100 }),
        batch({ id: 'c', expiryDate: null, quantity: 3 }),
      ];

      expect(availableQuantity(batches, TODAY)).toBe(10);
    });
  });

  describe('bat bien so cai', () => {
    it('ton sau cung = ton dau + SUM(quantityChange)', () => {
      // Day la bat bien P6-T2 dat ra, viet duoi dang kiem chung duoc bang ham thuan:
      // `quantity_after` cua dong cuoi chinh la `inventory_quantity` service se ghi,
      // va no phai bang tong cong don cua ca chuoi.
      const quantityBefore = 20;
      const changes = [
        { batchId: 'b1', quantityChange: +50 },
        { batchId: 'b1', quantityChange: -30 },
        { batchId: 'b2', quantityChange: +5 },
        { batchId: null, quantityChange: -12 },
      ];

      const lines = planLedgerLines(quantityBefore, changes);
      const sum = lines.reduce((total, line) => total + line.quantityChange, 0);

      expect(lines[lines.length - 1].quantityAfter).toBe(quantityBefore + sum);
      expect(lines[lines.length - 1].quantityAfter).toBe(33);
    });

    it('ton luy ke dung o TUNG buoc, khong chi o buoc cuoi', () => {
      const lines = planLedgerLines(0, [
        { batchId: 'b1', quantityChange: +10 },
        { batchId: 'b2', quantityChange: +5 },
        { batchId: 'b1', quantityChange: -10 },
      ]);

      expect(lines.map((line) => line.quantityAfter)).toEqual([10, 15, 5]);
    });

    it('mot chuoi xuat theo FEFO cong lai dung bang so da yeu cau', () => {
      const batches = [
        batch({ id: 'b1', expiryDate: '2027-01-31', quantity: 10 }),
        batch({ id: 'b2', expiryDate: '2027-06-30', quantity: 10 }),
      ];

      const allocations = allocateFefo(batches, 15, TODAY);
      const lines = planLedgerLines(
        20,
        allocations.map((a) => ({ batchId: a.batchId, quantityChange: -a.quantity })),
      );

      expect(lines.reduce((sum, line) => sum + line.quantityChange, 0)).toBe(-15);
      expect(lines[lines.length - 1].quantityAfter).toBe(5);
    });

    it('chan chuoi lam ton am o buoc giua - NFR-07', () => {
      expect(() =>
        planLedgerLines(5, [
          { batchId: 'b1', quantityChange: -10 },
          { batchId: 'b1', quantityChange: +20 },
        ]),
      ).toThrow(RangeError);
    });
  });

  describe('isValidSign', () => {
    it('nhap phai duong, xuat phai am', () => {
      expect(isValidSign(InventoryTransactionType.PURCHASE, 10)).toBe(true);
      expect(isValidSign(InventoryTransactionType.PURCHASE, -10)).toBe(false);
      expect(isValidSign(InventoryTransactionType.SALE, -1)).toBe(true);
      expect(isValidSign(InventoryTransactionType.SALE, 1)).toBe(false);
      expect(isValidSign(InventoryTransactionType.DISPENSE, -1)).toBe(true);
    });

    it('kiem ke va tra hang duoc phep mang ca hai dau', () => {
      expect(isValidSign(InventoryTransactionType.ADJUSTMENT, 5)).toBe(true);
      expect(isValidSign(InventoryTransactionType.ADJUSTMENT, -5)).toBe(true);
      expect(isValidSign(InventoryTransactionType.ADJUSTMENT, 0)).toBe(false);
      expect(isValidSign(InventoryTransactionType.RETURN, 5)).toBe(true);
      expect(isValidSign(InventoryTransactionType.RETURN, -5)).toBe(true);
    });
  });
});
