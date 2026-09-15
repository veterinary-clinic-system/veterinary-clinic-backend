
export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  DOCTOR = 'DOCTOR',
  RECEPTIONIST = 'RECEPTIONIST',
  PHARMACIST = 'PHARMACIST',
  STAFF = 'STAFF',
  PET_OWNER = 'PET_OWNER',
}

export const BRANCH_SCOPED_ROLES: readonly Role[] = [
  Role.MANAGER,
  Role.DOCTOR,
  Role.RECEPTIONIST,
  Role.PHARMACIST,
  Role.STAFF,
];

export const STAFF_ROLES: readonly Role[] = [Role.ADMIN, ...BRANCH_SCOPED_ROLES];
