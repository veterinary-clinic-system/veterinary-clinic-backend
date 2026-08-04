import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { EmployeesService } from '@/modules/identity/application/employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';

/**
 * Ho so nhan su - SRS FR-22. Khac voi `UsersController` (tai khoan dang nhap) va
 * `/users/doctors` (ho so chuyen mon bac si) - xem ghi chu trong employee.entity.ts.
 *
 * KHONG co route DELETE: nghi viec la mot TRANG THAI (`status = RESIGNED`), khong phai
 * viec xoa ban ghi. Ho so nhan su cu con phai tra cuu duoc de biet ai da thao tac gi
 * trong qua khu (audit log o Phase 10 tro nguoc ve day).
 */
@ApiTags('employees')
@Controller('employees')
@RequirePermissions(Permission.EMPLOYEE_MANAGE)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryEmployeesDto) {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }
}
