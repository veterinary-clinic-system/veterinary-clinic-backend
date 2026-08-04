import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';
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
 */
@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  /** Bac si duoc XEM ho so khach de tra cuu trong luc kham, nhung khong duoc sua. */
  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @Get()
  findAll(@Query() query: QueryCustomersDto) {
    return this.customersService.findAll(query);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @Get(':id/pets')
  findPets(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findPets(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @Get(':id/transactions')
  findTransactions(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findTransactions(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.deactivate(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post(':id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.activate(id);
  }
}
