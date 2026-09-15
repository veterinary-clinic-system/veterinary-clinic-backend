import { Role } from '../enums/role.enum';

/** Shape attached to `request.user` by JwtStrategy after a valid access token is verified. */
export interface AuthenticatedUser {
  userId: string;
  phone: string;
  role: Role;
  branchId: string | null;
}
