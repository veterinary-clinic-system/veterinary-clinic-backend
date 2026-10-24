import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength } from 'class-validator';
import { Public } from '@/shared/common/decorators/public.decorator';
import { CallsService } from '@/modules/messaging/application';

export class DeclineCallDto {
  @IsString()
  @MaxLength(128)
  token: string;
}

/**
 * Hành động trên thông báo cuộc gọi của app khi máy đang khoá/app đã tắt - không có access
 * token, xác thực bằng mã ký riêng cho từng cuộc gọi (xem CallsService.rejectWithToken).
 * Tách khỏi MessagingController vì controller đó gắn @Roles cho cả lớp.
 */
@ApiTags('messaging')
@Controller('messaging/calls')
export class CallActionsController {
  constructor(private readonly calls: CallsService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  async decline(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DeclineCallDto) {
    await this.calls.rejectWithToken(id, dto.token);
  }
}
