import { SlotInfo, SlotStatus, slotsCovering } from './availability.service';

/**
 * Luoi cua mot ngay lam viec thuc te: 07:00-11:00 roi nghi trua toi 13:30, ket thuc
 * luc 17:30. Dung 30 phut mot o giong `DEFAULT_SLOT_MINUTES`.
 */
function grid(date = '2026-08-17'): SlotInfo[] {
  const blocks: [string, string][] = [
    ['07:00', '11:00'],
    ['13:30', '17:30'],
  ];

  const slots: SlotInfo[] = [];
  for (const [open, close] of blocks) {
    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    const toHHmm = (mins: number) =>
      `${Math.floor(mins / 60)
        .toString()
        .padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;

    for (let cursor = toMinutes(open); cursor + 30 <= toMinutes(close); cursor += 30) {
      const start = toHHmm(cursor);
      const end = toHHmm(cursor + 30);
      slots.push({
        start,
        end,
        startAt: new Date(`${date}T${start}:00`),
        endAt: new Date(`${date}T${end}:00`),
        status: SlotStatus.FREE,
      });
    }
  }
  return slots;
}

const at = (hhmm: string, date = '2026-08-17') => new Date(`${date}T${hhmm}:00`);

describe('slotsCovering', () => {
  it('nhan mot ca 30 phut trung dung mot o', () => {
    const covered = slotsCovering(grid(), at('09:00'), at('09:30'));
    expect(covered?.map((slot) => slot.start)).toEqual(['09:00']);
  });

  it('nhan mot ca 60 phut nam gon trong ca lam viec', () => {
    const covered = slotsCovering(grid(), at('09:00'), at('10:00'));
    expect(covered?.map((slot) => slot.start)).toEqual(['09:00', '09:30']);
  });

  /**
   * Lo hong da tai hien duoc tren API that: "Phau thuat nho" (60 phut) dat luc 17:00
   * tra ve 201 va ket thuc luc 18:00, trong khi o cuoi cua ngay la 17:00-17:30.
   */
  it('tu choi ca vuot qua o cuoi cua ngay lam viec', () => {
    expect(slotsCovering(grid(), at('17:00'), at('18:00'))).toBeNull();
  });

  /** Lo hong thu hai: 10:30 + 60 phut de len gio nghi trua 11:00-13:30. */
  it('tu choi ca dam vao gio nghi trua', () => {
    expect(slotsCovering(grid(), at('10:30'), at('11:30'))).toBeNull();
  });

  /**
   * Kiem tra "o cuoi cham toi endAt" mot minh la chua du: mot ca dai co the nhay QUA
   * khe ho nghi trua roi dem tiep cac o buoi chieu cho du.
   */
  it('tu choi ca nhay qua khe ho giua hai ca lam viec', () => {
    expect(slotsCovering(grid(), at('10:30'), at('14:30'))).toBeNull();
  });

  it('tu choi gio bat dau khong trung mep o', () => {
    expect(slotsCovering(grid(), at('09:05'), at('09:35'))).toBeNull();
  });

  it('tu choi gio nam ngoai luoi hoan toan', () => {
    expect(slotsCovering(grid(), at('06:00'), at('06:30'))).toBeNull();
  });

  it('giu nguyen trang thai cua tung o de nguoi goi tu phan xu', () => {
    const slots = grid();
    slots.find((slot) => slot.start === '09:30')!.status = SlotStatus.BOOKED;

    const covered = slotsCovering(slots, at('09:00'), at('10:00'));
    expect(covered?.map((slot) => slot.status)).toEqual([SlotStatus.FREE, SlotStatus.BOOKED]);
  });
});
