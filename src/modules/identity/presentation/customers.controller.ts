import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { CustomersService } from '@/modules/identity/application/customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';

/**
 * Ho so khach hang (Role.PET_OWNER) nhin tu quay le tan.
 *
 * Tach khoi `UsersController` co chu dich: `UsersController` la CRUD tai khoan NHAN SU
 * cua Admin (tao tai khoan, gan chi nhanh, xep ca bac si), con day la nghiep vu KHACH
 * HANG cua le tan - khac quyen, khac bo loc, khac du lieu tra ve (so thu cung, lich su
 * giao dich). `GET /users/pet-owners` cu van giu nguyen vi Combobox tim nhanh trong man
 * hinh dat lich dang dung no.
 *
 * KHONG co route DELETE: theo rang buoc R6 (Phan V.4) du lieu y te khong duoc xoa cung,
 * va toan bo lich su kham/hoa don deu tro ve `users.id`. "Xoa khach hang" trong nghiep
 * vu chinh la `POST :id/deactivate`.
 *
 * Quyen: dieu khien hoan toan bang `@RequirePermissions` (ma tran `role_permissions`),
 * khong con `@Roles` - xem ghi chu ve nguyen tac nay trong permissions.controller.ts.
 */
@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @RequirePermissions(Permission.CUSTOMER_CREATE)
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

  /** Tab "Lich hen" cua ho so khach (FR-03-04). */
  @RequirePermissions(Permission.CUSTOMER_VIEW, Permission.APPOINTMENT_VIEW)
  @Get(':id/appointments')
  findAppointments(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findAppointments(id);
  }

  /** Tab "Lich su kham" cua ho so khach (FR-03-04). */
  @RequirePermissions(Permission.CUSTOMER_VIEW, Permission.MEDICAL_RECORD_VIEW)
  @Get(':id/medical-history')
  findMedicalHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findMedicalHistory(id);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW, Permission.INVOICE_VIEW)
  @Get(':id/transactions')
  findTransactions(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findTransactions(id);
  }

  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  /** "Xoa" khach hang trong nghiep vu = ngung hoat dong, nen dung quyen CUSTOMER_DELETE. */
  @RequirePermissions(Permission.CUSTOMER_DELETE)
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.deactivate(id);
  }

  @RequirePermissions(Permission.CUSTOMER_DELETE)
  @Post(':id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.activate(id);
  }
}
