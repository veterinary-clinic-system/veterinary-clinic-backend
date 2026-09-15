import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { STAFF_ROLES } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { StaffNotificationsService } from '@/modules/notification/application/staff-notifications.service';
import { QueryStaffNotificationsDto } from './dto/query-staff-notifications.dto';

@ApiTags('staff-notifications')
@Roles(...STAFF_ROLES)
@Controller('staff-notifications')
export class StaffNotificationsController {
  constructor(private readonly staffNotificationsService: StaffNotificationsService) {}

  @Get()
  findMine(@Query() query: QueryStaffNotificationsDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.staffNotificationsService.findForUser(actor.userId, {
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly,
    });
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return { unread: await this.staffNotificationsService.countUnread(actor.userId) };
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.staffNotificationsService.markRead(actor.userId, id);
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() actor: AuthenticatedUser) {
    return { updated: await this.staffNotificationsService.markAllRead(actor.userId) };
  }
}
