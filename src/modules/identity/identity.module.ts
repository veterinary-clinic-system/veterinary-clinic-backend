import { Module } from '@nestjs/common';
import { AuditLogModule } from './audit-log.module';
import { AuthModule } from './auth.module';
import { CustomersModule } from './customers.module';
import { EmployeesModule } from './employees.module';
import { PermissionsModule } from './permissions.module';
import { UsersModule } from './users.module';

/**
 * Bounded context `identity` (Phan III tai lieu kien truc): User, Role, RBAC, AuditLog.
 *
 * Xac thuc (AuthModule), quan ly nguoi dung/bac si (UsersModule) va ho so khach hang
 * (CustomersModule) la ba nhom use case khac nhau nhung dung chung mot mo hinh du lieu
 * (`User`) va cung mot ranh gioi nhat quan - nen chung nam trong mot bounded context,
 * duoc gom lai o day. Cac module khac chi import `IdentityModule`, khong import truc
 * tiep AuthModule/UsersModule/CustomersModule ben trong.
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    CustomersModule,
    PermissionsModule,
    EmployeesModule,
    AuditLogModule,
  ],
  exports: [
    AuthModule,
    UsersModule,
    CustomersModule,
    PermissionsModule,
    EmployeesModule,
    AuditLogModule,
  ],
})
export class IdentityModule {}
