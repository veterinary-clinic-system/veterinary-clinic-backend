import { Role } from '@/shared/common/enums/role.enum';

export interface AccessTokenPayload {
  sub: string;
  phone: string;
  role: Role;
  branchId: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthRequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}
