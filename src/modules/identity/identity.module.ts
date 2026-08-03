import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { UsersModule } from './users.module';

/**
 * Bounded context `identity` (Phan III tai lieu kien truc): User, Role, RBAC, AuditLog.
 *
 * Xac thuc (AuthModule) va quan ly nguoi dung/bac si (UsersModule) la hai nhom use case
 * khac nhau nhung dung chung mot mo hinh du lieu va cung mot ranh gioi nhat quan -
 * nen chung nam trong mot bounded context, duoc gom lai o day. Cac module khac chi
 * import `IdentityModule`, khong import truc tiep AuthModule/UsersModule ben trong.
 */
@Module({
  imports: [AuthModule, UsersModule],
  exports: [AuthModule, UsersModule],
})
export class IdentityModule {}
