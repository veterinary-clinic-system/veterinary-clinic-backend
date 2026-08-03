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
