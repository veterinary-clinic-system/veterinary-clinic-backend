import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { QueueService } from '@/modules/scheduling/application/queue.service';
import { CheckInDto } from './dto/check-in.dto';
import { CreateWalkInDto } from './dto/create-walk-in.dto';
import { AssignDoctorDto } from './dto/assign-doctor.dto';
import { UpdateQueueEntryDto } from './dto/update-queue-entry.dto';
import { QueryQueueDto } from './dto/query-queue.dto';

/**
 * Quay le tan - hang cho trong ngay.
 *
 * Bac si duoc XEM hang cho (de biet ai dang doi minh) va duoc doi trang thai luot cho
 * (goi khach vao phong / bao da kham xong), nhung viec TIEP NHAN khach - check-in,
 * mo luot vang lai, phan cong bac si - la thao tac cua le tan/quan tri.
 */
@ApiTags('queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Roles(Role.RECEPTIONIST, Role.ADMIN, Role.DOCTOR)
  @Get()
  list(@Query() query: QueryQueueDto) {
    return this.queueService.list(query);
  }

  @Roles(Role.RECEPTIONIST, Role.ADMIN, Role.DOCTOR)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.findOne(id);
  }

  /** Xac nhan khach da den (lich hen dat truoc). */
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Post('check-in')
  checkIn(@Body() dto: CheckInDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.queueService.checkIn(dto, actor);
  }

  /** Tao luot kham khong dat lich va dua thang vao hang cho. */
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Post('walk-in')
  createWalkIn(@Body() dto: CreateWalkInDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.queueService.createWalkIn(dto, actor);
  }

  /** Gan (hoac doi) bac si phu trach mot luot cho. */
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Patch(':id/assign')
  assignDoctor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDoctorDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.queueService.assignDoctor(id, dto, actor);
  }

  @Roles(Role.RECEPTIONIST, Role.ADMIN, Role.DOCTOR)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateQueueEntryDto) {
    return this.queueService.update(id, dto);
  }
}
