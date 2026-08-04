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
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
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
import { CancelAppointmentDto, MarkNoShowDto } from './dto/cancel-appointment.dto';
import { QueryWeekDto } from './dto/query-week.dto';
import { QueryDayDto, QueryMonthDto } from './dto/query-calendar.dto';

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
  @RequirePermissions(Permission.APPOINTMENT_CREATE)
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
  @RequirePermissions(Permission.APPOINTMENT_VIEW)
  @Get('calendar')
  getStaffCalendar(@Query() query: QueryWeekDto) {
    return this.appointmentsService.getWeekCalendar(
      query.branchId,
      query.doctorId,
      query.weekOf ? new Date(query.weekOf) : new Date(),
      true,
    );
  }

  /** Che do NGAY cua lich lam viec nhan vien (FR-05-03). */
  @RequirePermissions(Permission.APPOINTMENT_VIEW)
  @Get('calendar/day')
  getDayCalendar(@Query() query: QueryDayDto) {
    return this.appointmentsService.getDayCalendar(
      query.branchId,
      query.doctorId,
      query.date ? new Date(query.date) : new Date(),
    );
  }

  /** Che do THANG (FR-05-03) - so lieu tong hop moi ngay, khong dung luoi slot. */
  @RequirePermissions(Permission.APPOINTMENT_VIEW)
  @Get('calendar/month')
  getMonthCalendar(@Query() query: QueryMonthDto) {
    return this.appointmentsService.getMonthCalendar(
      query.branchId,
      query.doctorId,
      query.monthOf ? new Date(query.monthOf) : new Date(),
    );
  }

  @Roles(Role.PET_OWNER)
  @Get('mine')
  listMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.appointmentsService.listForOwner(actor);
  }

  @RequirePermissions(Permission.APPOINTMENT_VIEW)
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

  /**
   * Co y KHONG gan `@RequirePermissions`: route nay phuc vu ca nhan vien lan chu thu
   * cung xem lich cua chinh minh. Hang rao that nam trong service - `findOneForOwner`
   * nem ForbiddenException neu lich khong thuoc ve nguoi goi.
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return actor.role === Role.PET_OWNER
      ? this.appointmentsService.findOneForOwner(id, actor)
      : this.appointmentsService.findOne(id);
  }

  @RequirePermissions(Permission.APPOINTMENT_UPDATE)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.appointmentsService.update(id, dto, actor);
  }

  /** Cung ly do voi `findOne` o tren - `cancel` tu kiem tra quyen so huu voi PET_OWNER. */
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.appointmentsService.cancel(id, dto, actor);
  }

  /**
   * Danh dau khach khong den (FR-06-03) - thao tac cua quay le tan, khong phai cua chu
   * thu cung, nen co `@RequirePermissions` trong khi `cancel` o tren thi khong.
   */
  @RequirePermissions(Permission.APPOINTMENT_UPDATE)
  @Post(':id/no-show')
  markNoShow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkNoShowDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.appointmentsService.markNoShow(id, dto, actor);
  }

  @RequirePermissions(Permission.APPOINTMENT_CREATE)
  @Post(':id/follow-up')
  scheduleFollowUp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Pick<CreateBookingDto, 'doctorId' | 'branchId' | 'serviceId' | 'startAt'>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.appointmentsService.scheduleFollowUp(id, dto, actor);
  }
}
