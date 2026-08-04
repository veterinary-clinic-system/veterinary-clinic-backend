/** Trang thai lam viec cua nhan vien - SRS FR-22. */
export enum EmployeeStatus {
  /** Dang thu viec. */
  PROBATION = 'PROBATION',
  /** Dang lam viec chinh thuc. */
  ACTIVE = 'ACTIVE',
  /** Tam dinh chi - van la nhan su cua co so nhung khong duoc thao tac. */
  SUSPENDED = 'SUSPENDED',
  /** Da nghi viec. */
  RESIGNED = 'RESIGNED',
}

/**
 * Trang thai KHONG cho phep dang nhap. Khi ho so nhan su chuyen sang mot trong hai
 * trang thai nay, tai khoan `User` lien ket bi dat `active = false` trong cung
 * transaction - xem `EmployeesService.update`.
 */
export const NON_WORKING_EMPLOYEE_STATUSES: readonly EmployeeStatus[] = [
  EmployeeStatus.SUSPENDED,
  EmployeeStatus.RESIGNED,
];
