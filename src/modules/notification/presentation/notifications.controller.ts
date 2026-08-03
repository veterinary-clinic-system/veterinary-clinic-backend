import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';
import { Notification } from '@/modules/notification/domain/entities/notification.entity';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';

@ApiTags('notifications')
@Controller('notifications')
@Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
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
