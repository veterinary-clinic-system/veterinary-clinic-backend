
export enum EmployeeStatus {
  
  PROBATION = 'PROBATION',
  
  ACTIVE = 'ACTIVE',
  
  SUSPENDED = 'SUSPENDED',
  
  RESIGNED = 'RESIGNED',
}

export const NON_WORKING_EMPLOYEE_STATUSES: readonly EmployeeStatus[] = [
  EmployeeStatus.SUSPENDED,
  EmployeeStatus.RESIGNED,
];
