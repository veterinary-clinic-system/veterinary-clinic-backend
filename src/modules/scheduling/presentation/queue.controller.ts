import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { QueueService } from '@/modules/scheduling/application/queue.service';
import { CheckInDto } from './dto/check-in.dto';
import { CreateWalkInDto } from './dto/create-walk-in.dto';
import { AssignDoctorDto } from './dto/assign-doctor.dto';
import { UpdateQueueEntryDto } from './dto/update-queue-entry.dto';
import { QueryQueueDto } from './dto/query-queue.dto';

@ApiTags('queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @RequirePermissions(Permission.QUEUE_VIEW)
  @Get()
  list(@Query() query: QueryQueueDto) {
    return this.queueService.list(query);
  }

  @RequirePermissions(Permission.QUEUE_VIEW)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.queueService.findOne(id);
  }

  @RequirePermissions(Permission.QUEUE_MANAGE)
  @Post('check-in')
  checkIn(@Body() dto: CheckInDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.queueService.checkIn(dto, actor);
  }

  @RequirePermissions(Permission.QUEUE_MANAGE)
  @Post('walk-in')
  createWalkIn(@Body() dto: CreateWalkInDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.queueService.createWalkIn(dto, actor);
  }

  @RequirePermissions(Permission.QUEUE_MANAGE)
  @Patch(':id/assign')
  assignDoctor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDoctorDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.queueService.assignDoctor(id, dto, actor);
  }

  @RequirePermissions(Permission.QUEUE_MANAGE)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQueueEntryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.queueService.update(id, dto, actor);
  }
}
