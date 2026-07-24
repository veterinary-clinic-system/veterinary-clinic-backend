import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { AiClientService } from './ai-client/ai-client.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

/**
 * Proxies the Section 6 "AI chat assistant" so the web app never talks to
 * veterinary-clinic-ai directly (Section 3: the backend is the only thing the frontend
 * talks to, and the only place auth/rate-limiting is enforced). Public because a Guest
 * should be able to ask general questions before ever booking.
 */
@ApiTags('ai-chat')
@Controller('ai-chat')
@UseGuards(ThrottlerGuard)
export class AiChatController {
  constructor(private readonly aiClient: AiClientService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  send(@Body() dto: SendChatMessageDto) {
    return this.aiClient.chat({
      session_id: dto.sessionId,
      message: dto.message,
      history: dto.history,
    });
  }
}
