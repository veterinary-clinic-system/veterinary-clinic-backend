import {
  Body,
  Controller,
  ForbiddenException,
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
import { PartyResolverService } from '@/modules/scheduling/application/party-resolver.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { LookupOwnerDto } from './dto/lookup-owner.dto';
import { DoctorAbsenceDto } from './dto/doctor-absence.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CancelAppointmentDto, MarkNoShowDto } from './dto/cancel-appointment.dto';
import { QueryWeekDto } from './dto/query-week.dto';
import { QueryDayDto, QueryMonthDto } from './dto/query-calendar.dto';
import { Audit } from '@/shared/common/decorators/audit.decorator';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';
import { BillingService } from '@/modules/billing/application/billing.service';
import { SepayService } from '@/modules/billing/application/sepay.service';
import { CreateBookingCheckoutDto } from './dto/create-booking-checkout.dto';

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly partyResolver: PartyResolverService,
    private readonly billingService: BillingService,
    private readonly sepayService: SepayService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post()
  createPublicBooking(@Body() dto: CreateBookingDto) {
    return this.appointmentsService.createBooking(dto, null);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/checkout')
  async createPublicBookingCheckout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBookingCheckoutDto,
  ) {
    const appointment = await this.appointmentsService.findOne(id);
    if (this.normalizePhone(appointment.pet.owner.phone) !== this.normalizePhone(dto.phone)) {
      throw new ForbiddenException('Số điện thoại không khớp với lịch hẹn');
    }

    const invoice = await this.billingService.generateForAppointment(id);
    return this.sepayService.createQrTicket(invoice.id);
  }

  @RequirePermissions(Permission.APPOINTMENT_CREATE)
  @Post('staff')
  createStaffBooking(@Body() dto: CreateBookingDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.appointmentsService.createBooking(dto, actor.userId);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('owner-lookup')
  lookupOwner(@Query() query: LookupOwnerDto) {
    return this.partyResolver.lookupOwnerForBooking(query.phone);
  }

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

  @RequirePermissions(Permission.APPOINTMENT_VIEW)
  @Get('calendar/day')
  getDayCalendar(@Query() query: QueryDayDto) {
    return this.appointmentsService.getDayCalendar(
      query.branchId,
      query.doctorId,
      query.date ? new Date(query.date) : new Date(),
    );
  }

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

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return actor.role === Role.PET_OWNER
      ? this.appointmentsService.findOneForOwner(id, actor)
      : this.appointmentsService.findOne(id);
  }

  @RequirePermissions(Permission.APPOINTMENT_UPDATE)
  @Audit({
    action: AuditAction.UPDATE,
    entity: 'Appointment',
    resolveAction: (body) => {
      const status = (body as { status?: string } | undefined)?.status;
      if (status === AppointmentStatus.CONFIRMED) return AuditAction.APPROVE;
      if (status === AppointmentStatus.CANCELLED) return AuditAction.CANCEL;
      return undefined;
    },
  })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.appointmentsService.update(id, dto, actor);
  }

  @Audit({ action: AuditAction.CANCEL, entity: 'Appointment' })
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.appointmentsService.cancel(id, dto, actor);
  }

  @RequirePermissions(Permission.APPOINTMENT_UPDATE)
  @Audit({ action: AuditAction.UPDATE, entity: 'Appointment' })
  @Post(':id/no-show')
  markNoShow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkNoShowDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.appointmentsService.markNoShow(id, dto, actor);
  }

  @RequirePermissions(Permission.APPOINTMENT_UPDATE)
  @Audit({ action: AuditAction.UPDATE, entity: 'Appointment' })
  @Post('doctor-absence')
  handleDoctorAbsence(@Body() dto: DoctorAbsenceDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.appointmentsService.handleDoctorAbsence(dto, actor);
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

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^84/, '0');
  }
}
