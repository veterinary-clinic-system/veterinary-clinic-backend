import { ConflictException } from '@nestjs/common';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Prescription } from '@/modules/clinical/domain/entities/prescription.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import {
  InventoryReferenceType,
  InventoryTransactionType,
} from '@/shared/common/enums/inventory-transaction-type.enum';
import { PrescriptionStatus } from '@/shared/common/enums/prescription-status.enum';
import { PrescriptionsService } from './prescriptions.service';

/**
 * Test cho `PrescriptionsService.dispense` - buoc tien va kho gap nhau (P7-T4).
 *
 * KHONG dung CSDL: cai can khang dinh o day la LUAT DIEU PHOI, khong phai hanh vi cua
 * Postgres. Cu the la ba dieu, va ca ba deu quan sat duoc qua mot `InventoryService`
 * gia:
 *
 *   1. Mot dong thieu ton -> KHONG dong nao bi tru (`issue` khong duoc goi lan nao).
 *      Day la muc ma Definition of Done cua phase 7 goi dich danh. Neu ai do sau nay
 *      doi vong lap kiem tra thanh "kiem den dau tru den do", test nay do ngay - trong
 *      khi transaction that van se rollback nen mot test tich hop co the KHONG bat duoc
 *      loi do neu chi nhin ton cuoi cung.
 *   2. Don da `DISPENSED` khong tru kho lan hai.
 *   3. So luong tru kho lay tu `quantity` (P7-T1) chu khong phai `durationDays`.
 *
 * Phan con lai - transaction that co rollback that, va advisory lock chan hai duoc si
 * bam cung luc - can Postgres that moi kiem chung duoc; do la viec cua smoke test bang
 * API that.
 */
describe('PrescriptionsService.dispense', () => {
  const BRANCH_ID = 'branch-1';
  const PRESCRIPTION_ID = 'presc-1';

  interface Line {
    id: string;
    medicationItemId: string;
    medicationName: string;
    quantity: number;
    durationDays: number;
  }

  function buildPrescription(lines: Line[], status = PrescriptionStatus.DISPENSING) {
    return {
      id: PRESCRIPTION_ID,
      medicalRecordId: 'record-1',
      status,
      items: lines.map((line) => ({
        id: line.id,
        medicationId: `med-${line.id}`,
        quantity: line.quantity,
        durationDays: line.durationDays,
        medication: {
          itemId: line.medicationItemId,
          item: { itemName: line.medicationName },
        },
      })),
    } as unknown as Prescription;
  }

  function makeService(options: {
    lines: Line[];
    /** Ton kha dung theo `itemId` cua thuoc. */
    available: Record<string, number>;
    status?: PrescriptionStatus;
  }) {
    const prescription = buildPrescription(options.lines, options.status);

    const issue = jest.fn().mockResolvedValue([]);
    const getAvailable = jest
      .fn()
      .mockImplementation(async (itemId: string) => options.available[itemId] ?? 0);

    const manager = {
      query: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockImplementation(async (entity: unknown) => {
        if (entity === Prescription) return prescription;
        if (entity === MedicalRecord) return { id: 'record-1', appointmentId: 'appt-1' };
        if (entity === Appointment) return { id: 'appt-1', branchId: BRANCH_ID };
        return null;
      }),
    };

    const dataSource = {
      manager,
      transaction: (work: (em: typeof manager) => Promise<unknown>) => work(manager),
    };

    const prescriptionsRepository = {
      findOne: jest.fn().mockResolvedValue(prescription),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const service = new PrescriptionsService(
      prescriptionsRepository as never,
      { issue, getAvailable } as never,
      dataSource as never,
    );

    return { service, issue, getAvailable, manager };
  }

  const TWO_LINES: Line[] = [
    {
      id: 'l1',
      medicationItemId: 'item-a',
      medicationName: 'Amoxicillin',
      quantity: 10,
      durationDays: 5,
    },
    {
      id: 'l2',
      medicationItemId: 'item-b',
      medicationName: 'Meloxicam',
      quantity: 4,
      durationDays: 2,
    },
  ];

  it('mot dong thieu ton -> ca don 409 va KHONG dong nao bi tru', async () => {
    const { service, issue } = makeService({
      lines: TWO_LINES,
      // Dong dau du, dong sau thieu - dung thu tu de bat loi "kiem den dau tru den do".
      available: { 'item-a': 100, 'item-b': 1 },
    });

    await expect(service.dispense(PRESCRIPTION_ID, 'user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(issue).not.toHaveBeenCalled();
  });

  it('thong bao thieu ton liet ke DU moi dong thieu, khong dung o dong dau tien', async () => {
    const { service } = makeService({
      lines: TWO_LINES,
      available: { 'item-a': 0, 'item-b': 0 },
    });

    await expect(service.dispense(PRESCRIPTION_ID, 'user-1')).rejects.toThrow(
      /Amoxicillin.*Meloxicam/s,
    );
  });

  it('don da DISPENSED -> 409, kho khong bi tru lan hai', async () => {
    const { service, issue } = makeService({
      lines: TWO_LINES,
      available: { 'item-a': 100, 'item-b': 100 },
      status: PrescriptionStatus.DISPENSED,
    });

    await expect(service.dispense(PRESCRIPTION_ID, 'user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(issue).not.toHaveBeenCalled();
  });

  it('don da CANCELLED khong cap phat duoc', async () => {
    const { service, issue } = makeService({
      lines: TWO_LINES,
      available: { 'item-a': 100, 'item-b': 100 },
      status: PrescriptionStatus.CANCELLED,
    });

    await expect(service.dispense(PRESCRIPTION_ID, 'user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(issue).not.toHaveBeenCalled();
  });

  it('du ton -> tru dung mot lan moi dong, theo `quantity` chu khong phai `durationDays`', async () => {
    const { service, issue } = makeService({
      lines: TWO_LINES,
      available: { 'item-a': 100, 'item-b': 100 },
    });

    await service.dispense(PRESCRIPTION_ID, 'user-1');

    expect(issue).toHaveBeenCalledTimes(2);
    expect(issue.mock.calls.map(([params]) => [params.itemId, params.quantity])).toEqual([
      ['item-a', 10],
      ['item-b', 4],
    ]);
  });

  it('moi lan tru kho deu duoc gan nhan DISPENSE va tro ve don thuoc', async () => {
    const { service, issue } = makeService({
      lines: TWO_LINES,
      available: { 'item-a': 100, 'item-b': 100 },
    });

    await service.dispense(PRESCRIPTION_ID, 'user-1');

    for (const [params] of issue.mock.calls) {
      expect(params.type).toBe(InventoryTransactionType.DISPENSE);
      expect(params.referenceType).toBe(InventoryReferenceType.PRESCRIPTION);
      expect(params.referenceId).toBe(PRESCRIPTION_ID);
      expect(params.performedByUserId).toBe('user-1');
      expect(params.branchId).toBe(BRANCH_ID);
    }
  });

  it('tru kho chay trong CUNG transaction cua don - khong tu mo transaction rieng', async () => {
    const { service, issue, manager } = makeService({
      lines: TWO_LINES,
      available: { 'item-a': 100, 'item-b': 100 },
    });

    await service.dispense(PRESCRIPTION_ID, 'user-1');

    // Tham so thu hai cua `issue` la EntityManager cua transaction dang chay. Thieu no
    // thi InventoryService tu mo transaction rieng va rollback cua don se khong keo
    // theo cac lenh tru kho - dung loi ma NFR-07 muon tranh.
    for (const call of issue.mock.calls) {
      expect(call[1]).toBe(manager);
    }
  });

  it('khoa theo don truoc khi doc trang thai - chan hai duoc si bam cung luc', async () => {
    const { service, manager } = makeService({
      lines: TWO_LINES,
      available: { 'item-a': 100, 'item-b': 100 },
    });

    await service.dispense(PRESCRIPTION_ID, 'user-1');

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [
      `prescription:${PRESCRIPTION_ID}`,
    ]);
  });
});
