import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { OwnerNotificationsService } from '@/modules/notification/application/owner-notifications.service';

/** Hộp thông báo của chủ nuôi - chỉ tự phục vụ. */
@ApiTags('owner-notifications')
@Roles(Role.PET_OWNER)
@Controller('me/notifications')
export class OwnerNotificationsController {
  constructor(private readonly ownerNotifications: OwnerNotificationsService) {}

  @Get()
  findMine(@Query() query: PaginationQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.ownerNotifications.findForUser(actor.userId, {
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return { unread: await this.ownerNotifications.countUnread(actor.userId) };
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.ownerNotifications.markRead(actor.userId, id);
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() actor: AuthenticatedUser) {
    return { updated: await this.ownerNotifications.markAllRead(actor.userId) };
  }
}
