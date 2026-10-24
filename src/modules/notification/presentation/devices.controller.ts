import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { PushNotificationsService } from '@/modules/notification/application/push-notifications.service';
import { DevicePlatform } from '@/modules/notification/domain/entities/device-token.entity';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';

export class RegisterDeviceDto {
  /** Expo push token, dạng `ExponentPushToken[...]`. */
  @IsString()
  @MaxLength(255)
  @Matches(/^Expo(nent)?PushToken\[[^\]]+\]$/, { message: 'Push token không hợp lệ' })
  token: string;

  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}

/** Máy của chủ nuôi đăng ký/huỷ nhận thông báo đẩy (app VetCare). Chỉ tự phục vụ. */
@ApiTags('devices')
@Controller('devices')
@Roles(Role.PET_OWNER)
export class DevicesController {
  constructor(private readonly push: PushNotificationsService) {}

  @Post()
  register(@CurrentUser() actor: AuthenticatedUser, @Body() dto: RegisterDeviceDto) {
    return this.push.registerDevice({
      userId: actor.userId,
      phone: actor.phone,
      token: dto.token,
      platform: dto.platform,
    });
  }

  @Delete(':token')
  @HttpCode(204)
  async unregister(@CurrentUser() actor: AuthenticatedUser, @Param('token') token: string) {
    await this.push.unregisterDevice(actor.userId, token);
  }
}
