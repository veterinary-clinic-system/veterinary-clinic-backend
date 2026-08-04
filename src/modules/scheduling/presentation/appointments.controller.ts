import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@/shared/common/decorators/public.decorator';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { AppointmentStatus } from '@/shared/common/enums/appointment-status.enum';
import { AppointmentsService } from '@/modules/scheduling/application/appointments.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryWeekDto } from './dto/query-week.dto';

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /** Guest or logged-in PetOwner self-booking (Section 4.1.2: "No login required to book"). */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post()
  createPublicBooking(@Body() dto: CreateBookingDto) {
    return this.appointmentsService.createBooking(dto, null);
  }

  /** Receptionist "can also create bookings on a pet owner's behalf" (Section 4.1.2). */
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Post('staff')
  createStaffBooking(@Body() dto: CreateBookingDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.appointmentsService.createBooking(dto, actor.userId);
  }

  /** Public free/busy widget for the booking form - never exposes appointment detail. */
  @Public()
  @Get('calendar/public')
  getPublicCalendar(@Query() query: QueryWeekDto) {
    return this.appointmentsService.getWeekCalendar(
      query.branchId,
      query.doctorId,
      query.weekOf ? new Date(query.weekOf) : new Date(),
      false,
    );
  }

  /** Staff calendar with full appointment detail (Section 4.2). */
  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
  @Get('calendar')
  getStaffCalendar(@Query() query: QueryWeekDto) {
    return this.appointmentsService.getWeekCalendar(
      query.branchId,
      query.doctorId,
      query.weekOf ? new Date(query.weekOf) : new Date(),
      true,
    );
  }

  @Roles(Role.PET_OWNER)
  @Get('mine')
  listMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.appointmentsService.listForOwner(actor);
  }

  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
  @Get()
  listForStaff(
    @Query() pagination: PaginationQueryDto,
    @Query('branchId') branchId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: AppointmentStatus,
    @Query('date') date?: string,
  ) {
    return this.appointmentsService.listForStaff({
      ...pagination,
      branchId,
      doctorId,
      status,
      date,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return actor.role === Role.PET_OWNER
      ? this.appointmentsService.findOneForOwner(id, actor)
      : this.appointmentsService.findOne(id);
  }

  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.appointmentsService.update(id, dto, actor);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.appointmentsService.cancel(id, actor);
  }

  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
  @Post(':id/follow-up')
  scheduleFollowUp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Pick<CreateBookingDto, 'doctorId' | 'branchId' | 'serviceId' | 'startAt'>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.appointmentsService.scheduleFollowUp(id, dto, actor);
  }
}
