import { SlotInfo, SlotStatus, slotsCovering } from './availability.service';

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

  it('tu choi ca vuot qua o cuoi cua ngay lam viec', () => {
    expect(slotsCovering(grid(), at('17:00'), at('18:00'))).toBeNull();
  });

  it('tu choi ca dam vao gio nghi trua', () => {
    expect(slotsCovering(grid(), at('10:30'), at('11:30'))).toBeNull();
  });

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
