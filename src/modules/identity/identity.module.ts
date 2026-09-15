import { Module } from '@nestjs/common';
import { AuditLogModule } from './audit-log.module';
import { AuthModule } from './auth.module';
import { CustomersModule } from './customers.module';
import { EmployeesModule } from './employees.module';
import { PermissionsModule } from './permissions.module';
import { UsersModule } from './users.module';

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
