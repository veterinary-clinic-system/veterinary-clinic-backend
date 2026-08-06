import { Role } from '@/shared/common/enums/role.enum';

export interface AccessTokenPayload {
  sub: string;
  phone: string;
  role: Role;
  branchId: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  /** Random id of the RefreshToken row, so a single stolen/rotated token can be revoked. */
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Thong tin cua chinh request, de `AuthService` ghi duoc `LOGIN`/`LOGOUT` kem IP va
 * trinh duyet (FR-26 doi hai cot nay).
 *
 * Truyen vao thay vi cho service tu doc request: tang application khong duoc biet den
 * `express`. Controller lay bang `@ClientIp()` roi chuyen xuong.
 */
export interface AuthRequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}
