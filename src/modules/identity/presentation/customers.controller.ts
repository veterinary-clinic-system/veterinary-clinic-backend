import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { CustomersService } from '@/modules/identity/application/customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { Audit } from '@/shared/common/decorators/audit.decorator';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @RequirePermissions(Permission.CUSTOMER_CREATE)
  @Audit({ action: AuditAction.CREATE, entity: 'User' })
  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW)
  @Get()
  findAll(@Query() query: QueryCustomersDto) {
    return this.customersService.findAll(query);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW, Permission.PET_VIEW)
  @Get(':id/pets')
  findPets(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findPets(id);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW, Permission.APPOINTMENT_VIEW)
  @Get(':id/appointments')
  findAppointments(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findAppointments(id);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW, Permission.MEDICAL_RECORD_VIEW)
  @Get(':id/medical-history')
  findMedicalHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findMedicalHistory(id);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW, Permission.INVOICE_VIEW)
  @Get(':id/purchases')
  findPurchases(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findPurchases(id);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW, Permission.INVOICE_VIEW)
  @Get(':id/transactions')
  findTransactions(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findTransactions(id);
  }

  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @Audit({ action: AuditAction.UPDATE, entity: 'User' })
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @RequirePermissions(Permission.CUSTOMER_DELETE)
  @Audit({ action: AuditAction.DELETE, entity: 'User' })
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.deactivate(id);
  }

  @RequirePermissions(Permission.CUSTOMER_DELETE)
  @Audit({ action: AuditAction.UPDATE, entity: 'User' })
  @Post(':id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.activate(id);
  }
}
