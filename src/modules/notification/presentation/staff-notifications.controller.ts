import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { STAFF_ROLES } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { StaffNotificationsService } from '@/modules/notification/application/staff-notifications.service';
import { QueryStaffNotificationsDto } from './dto/query-staff-notifications.dto';

/**
 * Hop thu trong ung dung cua CHINH nguoi dang dang nhap - SRS FR-23 (P10-T5).
 *
 * KHONG CO `@RequirePermissions` o day, va do la chu dich chu khong phai bo sot. Quy uoc
 * cua du an dat `@RequirePermissions` len moi endpoint NGHIEP VU, con day la mot route
 * TU PHUC VU: khong co "quyen xem thong bao" nao ca, moi nhan vien deu duoc doc hop thu
 * cua chinh minh va khong ai doc duoc hop thu cua nguoi khac. Rang buoc do khong den tu
 * ma tran quyen ma den tu chinh cau truy van - `recipientUserId` luon lay tu token, chua
 * bao gio tu tham so nguoi dung gui len.
 *
 * `@Roles(...STAFF_ROLES)` chan chu thu cung: ho co hop thu rieng o cong PET_OWNER.
 */
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

  /** Endpoint rieng cho chuong thong bao - no chi can mot con so, khong can ca trang. */
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
