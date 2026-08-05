import { ConflictException } from '@nestjs/common';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { Cart } from '@/modules/sales/domain/entities/cart.entity';
import { CartStatus } from '@/shared/common/enums/cart-status.enum';
import { InventoryTransactionType } from '@/shared/common/enums/inventory-transaction-type.enum';
import { InvoiceSource } from '@/shared/common/enums/invoice-source.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PosService } from './pos.service';

/**
 * Test cho `PosService.checkout` - buoc tien va kho gap nhau (P8-T5, UC-04).
 *
 * KHONG dung CSDL, cung ly le voi `prescriptions.service.spec.ts` cua P7: cai can khang
 * dinh o day la LUAT DIEU PHOI, khong phai hanh vi cua Postgres. Bon dieu, deu quan sat
 * duoc qua `InventoryService` va `PaymentsService` gia:
 *
 *   1. Mot dong thieu ton -> KHONG dong nao bi tru va KHONG hoa don nao duoc lap
 *      (BR-09). Transaction that se rollback, nen mot test tich hop chi nhin ton cuoi
 *      cung co the KHONG bat duoc loi "kiem den dau tru den do".
 *   2. Gia tren hoa don la gia LUC THANH TOAN doc tu danh muc, khong phai gia da luu
 *      trong gio (acceptance P8-T5).
 *   3. Thu tu bat buoc: lap hoa don -> ghi tien -> tru kho (BR-12). Tru kho truoc khi
 *      biet tien co thu duoc khong la cach nhanh nhat de mat hang.
 *   4. Giam gia vuot tam tinh -> 409, khong tru kho (P8-T6).
 *
 * Phan con lai - rollback that va advisory lock chan hai quay ban cung mot mon cuoi
 * cung - can Postgres that moi kiem chung duoc; do la viec cua smoke test bang API that.
 */
describe('PosService.checkout', () => {
  const CART_ID = 'cart-1';
  const BRANCH_ID = 'branch-1';

  interface Line {
    itemId: string;
    itemName: string;
    quantity: number;
    /** Gia da luu trong gio - CO Y khac gia danh muc de test snapshot gia. */
    cartPrice: number;
    catalogPrice: number;
    available: number;
  }

  function buildHarness(lines: Line[], options: { discountAmount?: number } = {}) {
    const calls: string[] = [];
    const issued: { itemId: string; quantity: number; type: InventoryTransactionType }[] = [];
    const savedInvoices: Partial<Invoice>[] = [];
    const recordedPayments: { amount: number; method: PaymentMethod }[] = [];

    const cart = {
      id: CART_ID,
      branchId: BRANCH_ID,
      customerId: null,
      status: CartStatus.OPEN,
      discountAmount: options.discountAmount ?? 0,
      items: lines.map((line, index) => ({
        id: `line-${index}`,
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.cartPrice,
        item: { itemName: line.itemName },
      })),
    } as unknown as Cart;

    const byItemId = new Map(lines.map((line) => [line.itemId, line]));

    const em = {
      query: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(cart),
      findOneOrFail: jest.fn(async (entity: unknown, opts: { where: { id: string } }) => {
        if (entity === Item) {
          const line = byItemId.get(opts.where.id)!;
          return { id: line.itemId, unitPrice: line.catalogPrice } as Item;
        }
        return { id: 'invoice-1', invoiceCode: 'HD000001' } as Invoice;
      }),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn(async (data: Partial<Invoice>) => {
        calls.push('save-invoice');
        savedInvoices.push(data);
        return { ...data, id: 'invoice-1' };
      }),
      update: jest.fn(async () => {
        calls.push('close-cart');
        return undefined;
      }),
    };

    const inventoryService = {
      getAvailable: jest.fn(async (itemId: string) => byItemId.get(itemId)?.available ?? 0),
      issue: jest.fn(
        async (params: { itemId: string; quantity: number; type: InventoryTransactionType }) => {
          calls.push('issue');
          issued.push(params);
          return [];
        },
      ),
    };

    const paymentsService = {
      record: jest.fn(async (params: { amount: number; method: PaymentMethod }) => {
        calls.push('record-payment');
        recordedPayments.push(params);
        return {};
      }),
      syncStatus: jest.fn(async () => undefined),
    };

    const dataSource = {
      transaction: (work: (em: unknown) => Promise<unknown>) => work(em),
      manager: {
        findOneOrFail: jest.fn(async () => ({ id: 'invoice-1' })),
      },
    };

    const service = new PosService(
      { findOneOrFail: jest.fn(async () => cart) } as never,
      {} as never,
      {} as never,
      inventoryService as never,
      paymentsService as never,
      dataSource as never,
    );

    return { service, calls, issued, savedInvoices, recordedPayments, inventoryService, em };
  }

  const twoLines: Line[] = [
    {
      itemId: 'item-a',
      itemName: 'Thuc an hat',
      quantity: 2,
      cartPrice: 300,
      catalogPrice: 350,
      available: 10,
    },
    {
      itemId: 'item-b',
      itemName: 'Vitamin',
      quantity: 1,
      cartPrice: 100,
      catalogPrice: 100,
      available: 5,
    },
  ];

  it('mot dong thieu ton -> 409 va KHONG dong nao bi tru, khong hoa don nao duoc lap', async () => {
    const harness = buildHarness([twoLines[0], { ...twoLines[1], available: 0 }]);

    await expect(
      harness.service.checkout(CART_ID, { paymentMethod: PaymentMethod.CASH }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(harness.inventoryService.issue).not.toHaveBeenCalled();
    expect(harness.savedInvoices).toHaveLength(0);
    expect(harness.recordedPayments).toHaveLength(0);
  });

  it('gia tren hoa don la gia danh muc LUC THANH TOAN, khong phai gia da luu trong gio', async () => {
    const harness = buildHarness(twoLines);

    await harness.service.checkout(CART_ID, { paymentMethod: PaymentMethod.CASH });

    const invoice = harness.savedInvoices[0];
    expect(invoice.source).toBe(InvoiceSource.POS);
    expect(invoice.appointmentId).toBeNull();
    // 2 x 350 (gia danh muc) + 1 x 100 = 800, chu khong phai 2 x 300 + 100 = 700.
    expect(invoice.subtotal).toBe(800);
    expect(invoice.totalAmount).toBe(800);
    expect(invoice.items?.map((line) => line.price)).toEqual([350, 100]);
  });

  it('thu tu: lap hoa don -> ghi tien -> tru kho -> dong gio', async () => {
    const harness = buildHarness(twoLines);

    await harness.service.checkout(CART_ID, { paymentMethod: PaymentMethod.CASH });

    expect(harness.calls).toEqual([
      'save-invoice',
      'record-payment',
      'issue',
      'issue',
      'close-cart',
    ]);
    expect(harness.issued.every((line) => line.type === InventoryTransactionType.SALE)).toBe(true);
    expect(harness.recordedPayments[0].amount).toBe(800);
  });

  it('giam gia vuot tam tinh -> 409, khong tru kho', async () => {
    const harness = buildHarness(twoLines, { discountAmount: 999_999 });

    await expect(
      harness.service.checkout(CART_ID, { paymentMethod: PaymentMethod.CASH }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(harness.inventoryService.issue).not.toHaveBeenCalled();
  });

  it('giam gia hop le tru vao tong phai thu', async () => {
    const harness = buildHarness(twoLines, { discountAmount: 200 });

    await harness.service.checkout(CART_ID, { paymentMethod: PaymentMethod.CASH });

    expect(harness.savedInvoices[0].subtotal).toBe(800);
    expect(harness.savedInvoices[0].discountAmount).toBe(200);
    expect(harness.savedInvoices[0].totalAmount).toBe(600);
    expect(harness.recordedPayments[0].amount).toBe(600);
  });

  /**
   * Giam gia 100% van phai ban duoc. Truoc khi sua, checkout chet o buoc ghi tien:
   * `PaymentsService.record` tu choi so tien 0, va ca don hang bi rollback.
   */
  it('giam gia 100% -> khong ghi dong thanh toan nao nhung van tru kho va dong gio', async () => {
    const harness = buildHarness(twoLines, { discountAmount: 800 });

    await harness.service.checkout(CART_ID, { paymentMethod: PaymentMethod.CASH });

    expect(harness.savedInvoices[0].totalAmount).toBe(0);
    expect(harness.recordedPayments).toHaveLength(0);
    expect(harness.calls).toEqual(['save-invoice', 'issue', 'issue', 'close-cart']);
  });
});
