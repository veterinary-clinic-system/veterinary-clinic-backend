/**
 * Duong dung thuoc - SRS FR-11-01 ("Route").
 *
 * La enum chu khong phai text tu do: duong dung quyet dinh cach dieu duong thao tac va
 * la mot trong nhung cho de gay hai nhat neu ghi mo ho. "Nho tai" va "nho mat" viet tay
 * rat de nhin nham nhau, con "tiem" thi khong duoc phep doan.
 */
export enum MedicationRoute {
  /** Uong. */
  ORAL = 'ORAL',
  /** Tiem (bap, tinh mach, duoi da - chi tiet ghi o `instructions`). */
  INJECTION = 'INJECTION',
  /** Boi ngoai da. */
  TOPICAL = 'TOPICAL',
  /** Nho mat. */
  OPHTHALMIC = 'OPHTHALMIC',
  /** Nho tai. */
  OTIC = 'OTIC',
  OTHER = 'OTHER',
}
