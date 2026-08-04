import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';
import { Notification } from '@/modules/notification/domain/entities/notification.entity';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';

@ApiTags('notifications')
@Controller('notifications')
@RequirePermissions(Permission.APPOINTMENT_VIEW)
export class NotificationsController {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  /** Delivery log for a single appointment's reminders/updates - lets staff audit the provider abstraction. */
  @Get()
  findByAppointment(@Query('appointmentId') appointmentId: string) {
    return this.notificationsRepository.find({
      where: { appointmentId },
      order: { createdAt: 'DESC' },
    });
  }
}
