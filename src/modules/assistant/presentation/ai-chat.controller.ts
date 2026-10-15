import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@/shared/common/decorators/public.decorator';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { AiChatAgentService } from '@/modules/assistant/application/ai-chat-agent.service';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

/**
 * Chat với trợ lý AI cho chủ nuôi. Public để khách vãng lai vẫn được tư vấn và đặt lịch
 * (giống form đặt lịch công khai), nhưng nếu có access token của CHỦ NUÔI thì trợ lý dùng
 * hồ sơ của họ: không hỏi lại SĐT/họ tên, chọn được bé đã có, và mới được tra cứu lịch
 * tiêm/tái khám - thứ không bao giờ được trả về chỉ vì ai đó gõ đúng một số điện thoại.
 */
@ApiTags('ai-chat')
@Controller('ai-chat')
@UseGuards(ThrottlerGuard, OptionalJwtAuthGuard)
export class AiChatController {
  constructor(private readonly agentService: AiChatAgentService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  send(@Body() dto: SendChatMessageDto, @CurrentUser() actor: AuthenticatedUser | null) {
    return this.agentService.processChat(dto, actor ?? null);
  }
}
