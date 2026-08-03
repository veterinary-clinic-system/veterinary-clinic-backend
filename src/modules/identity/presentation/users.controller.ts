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

/**
 * Route declaration order matters: Nest/Express matches routes per HTTP method in
 * declaration order, and a `:id`-shaped segment happily matches literal strings like
 * "doctors", "me" or "pet-owners". Every literal-path route below is declared before
 * the generic `:id` route sharing its segment count, per method.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // -- Doctors: public directory ----------------------------------------------------

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

  // -- Doctor shifts ------------------------------------------------------------------

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @Get('doctors/:id/shifts')
  getDoctorShifts(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getDoctorShifts(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post('doctors/:id/shifts')
  createDoctorShift(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDoctorShiftDto) {
    return this.usersService.createDoctorShift(id, dto);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch('doctors/shifts/:shiftId')
  updateDoctorShift(
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @Body() dto: UpdateDoctorShiftDto,
  ) {
    return this.usersService.updateDoctorShift(shiftId, dto);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Delete('doctors/shifts/:shiftId')
  deleteDoctorShift(@Param('shiftId', ParseUUIDPipe) shiftId: string) {
    return this.usersService.deleteDoctorShift(shiftId);
  }

  // -- Doctor breaks --------------------------------------------------------------

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @Get('doctors/:id/breaks')
  getDoctorBreaks(@Param('id', ParseUUIDPipe) id: string, @Query('date') date?: string) {
    return this.usersService.getDoctorBreaks(id, date);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post('doctors/:id/breaks')
  createDoctorBreak(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDoctorBreakDto) {
    return this.usersService.createDoctorBreak(id, dto);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Delete('doctors/breaks/:breakId')
  deleteDoctorBreak(@Param('breakId', ParseUUIDPipe) breakId: string) {
    return this.usersService.deleteDoctorBreak(breakId);
  }

  // -- Doctors: admin edit ----------------------------------------------------------

  @Roles(Role.ADMIN)
  @Patch('doctors/:id')
  updateDoctor(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDoctorDto) {
    return this.usersService.updateDoctor(id, dto);
  }

  // -- Current user (any authenticated role) -----------------------------------------

  @Get('me')
  getMe(@CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.getMe(actor.userId);
  }

  @Patch('me/password')
  async updateMyPassword(@CurrentUser() actor: AuthenticatedUser, @Body() dto: UpdatePasswordDto) {
    await this.usersService.updatePassword(actor.userId, dto);
    return { message: 'Password updated successfully' };
  }

  // -- Pet owners (receptionist customer lookup) --------------------------------------

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get('pet-owners')
  searchPetOwners(@Query() pagination: PaginationQueryDto, @Query('search') search?: string) {
    return this.usersService.searchPetOwners({ ...pagination, search });
  }

  // -- Users: admin CRUD (generic `:id` routes declared last) -------------------------

  @Roles(Role.ADMIN)
  @Get()
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('role') role?: Role,
    @Query('branchId') branchId?: string,
  ) {
    return this.usersService.findAll({ ...pagination, role, branchId });
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }
}
