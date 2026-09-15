/**
 * Matches the <<enumeration>> Role block in diagram.jpg.
 * GUEST is intentionally not a stored value - an unauthenticated visitor
 * never gets a User row until a booking auto-creates a PET_OWNER account.
 */
export enum Role {
  ADMIN = 'ADMIN',
  DOCTOR = 'DOCTOR',
  RECEPTIONIST = 'RECEPTIONIST',
  PET_OWNER = 'PET_OWNER',
}
