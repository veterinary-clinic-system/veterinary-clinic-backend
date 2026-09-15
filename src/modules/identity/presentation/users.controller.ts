import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/shared/common/decorators/public.decorator';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { UsersService } from '@/modules/identity/application/users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { CreateDoctorShiftDto } from './dto/create-doctor-shift.dto';
import { UpdateDoctorShiftDto } from './dto/update-doctor-shift.dto';
import { CreateDoctorBreakDto } from './dto/create-doctor-break.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Public()
  @Get('doctors')
  findPublicDoctors(@Query('branchId') branchId?: string) {
    return this.usersService.findPublicDoctors(branchId);
  }

  @Public()
  @Get('doctors/:id')
  findPublicDoctor(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findPublicDoctorById(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @RequirePermissions(Permission.APPOINTMENT_VIEW)
  @Get('doctors/:id/shifts')
  getDoctorShifts(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getDoctorShifts(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @Post('doctors/:id/shifts')
  createDoctorShift(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDoctorShiftDto) {
    return this.usersService.createDoctorShift(id, dto);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @Patch('doctors/shifts/:shiftId')
  updateDoctorShift(
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @Body() dto: UpdateDoctorShiftDto,
  ) {
    return this.usersService.updateDoctorShift(shiftId, dto);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @Delete('doctors/shifts/:shiftId')
  deleteDoctorShift(@Param('shiftId', ParseUUIDPipe) shiftId: string) {
    return this.usersService.deleteDoctorShift(shiftId);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @RequirePermissions(Permission.APPOINTMENT_VIEW)
  @Get('doctors/:id/breaks')
  getDoctorBreaks(@Param('id', ParseUUIDPipe) id: string, @Query('date') date?: string) {
    return this.usersService.getDoctorBreaks(id, date);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @Post('doctors/:id/breaks')
  createDoctorBreak(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDoctorBreakDto) {
    return this.usersService.createDoctorBreak(id, dto);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @Delete('doctors/breaks/:breakId')
  deleteDoctorBreak(@Param('breakId', ParseUUIDPipe) breakId: string) {
    return this.usersService.deleteDoctorBreak(breakId);
  }

  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @Patch('doctors/:id')
  updateDoctor(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDoctorDto) {
    return this.usersService.updateDoctor(id, dto);
  }

  @Get('me')
  getMe(@CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.getMe(actor.userId);
  }

  @Patch('me/password')
  async updateMyPassword(@CurrentUser() actor: AuthenticatedUser, @Body() dto: UpdatePasswordDto) {
    await this.usersService.updatePassword(actor.userId, dto);
    return { message: 'Password updated successfully' };
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @RequirePermissions(Permission.CUSTOMER_VIEW)
  @Get('pet-owners')
  searchPetOwners(@Query() pagination: PaginationQueryDto, @Query('search') search?: string) {
    return this.usersService.searchPetOwners({ ...pagination, search });
  }

  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @Get()
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('role') role?: Role,
    @Query('branchId') branchId?: string,
  ) {
    return this.usersService.findAll({ ...pagination, role, branchId });
  }

  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }
}
