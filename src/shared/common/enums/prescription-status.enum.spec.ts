import {
  EDITABLE_PRESCRIPTION_STATUSES,
  PrescriptionStatus,
  TERMINAL_PRESCRIPTION_STATUSES,
  isValidPrescriptionStatusTransition,
} from './prescription-status.enum';

describe('isValidPrescriptionStatusTransition', () => {
  const ALL = [
    PrescriptionStatus.PRESCRIBED,
    PrescriptionStatus.DISPENSING,
    PrescriptionStatus.DISPENSED,
    PrescriptionStatus.CANCELLED,
  ];

  const MATRIX: Record<PrescriptionStatus, Record<PrescriptionStatus, boolean>> = {
    [PrescriptionStatus.PRESCRIBED]: {
      [PrescriptionStatus.PRESCRIBED]: true,
      [PrescriptionStatus.DISPENSING]: true,
      [PrescriptionStatus.DISPENSED]: true,
      [PrescriptionStatus.CANCELLED]: true,
    },
    [PrescriptionStatus.DISPENSING]: {
      
      [PrescriptionStatus.PRESCRIBED]: false,
      [PrescriptionStatus.DISPENSING]: true,
      [PrescriptionStatus.DISPENSED]: true,
      [PrescriptionStatus.CANCELLED]: true,
    },
    [PrescriptionStatus.DISPENSED]: {
      
      [PrescriptionStatus.PRESCRIBED]: false,
      [PrescriptionStatus.DISPENSING]: false,
      [PrescriptionStatus.DISPENSED]: true,
      [PrescriptionStatus.CANCELLED]: false,
    },
    [PrescriptionStatus.CANCELLED]: {
      [PrescriptionStatus.PRESCRIBED]: false,
      [PrescriptionStatus.DISPENSING]: false,
      [PrescriptionStatus.DISPENSED]: false,
      [PrescriptionStatus.CANCELLED]: true,
    },
  };

  for (const from of ALL) {
    for (const to of ALL) {
      const expected = MATRIX[from][to];
      it(`${from} -> ${to} : ${expected ? 'cho phep' : 'tu choi'}`, () => {
        expect(isValidPrescriptionStatusTransition(from, to)).toBe(expected);
      });
    }
  }

  it('khong trang thai cuoi nao chuyen di dau duoc (tru chinh no)', () => {
    for (const from of TERMINAL_PRESCRIPTION_STATUSES) {
      for (const to of ALL) {
        expect(isValidPrescriptionStatusTransition(from, to)).toBe(from === to);
      }
    }
  });

  it('chi don PRESCRIBED moi sua duoc dong thuoc - acceptance P7-T2', () => {
    expect([...EDITABLE_PRESCRIPTION_STATUSES]).toEqual([PrescriptionStatus.PRESCRIBED]);
    expect(EDITABLE_PRESCRIPTION_STATUSES.has(PrescriptionStatus.DISPENSED)).toBe(false);
    expect(EDITABLE_PRESCRIPTION_STATUSES.has(PrescriptionStatus.DISPENSING)).toBe(false);
  });
});
