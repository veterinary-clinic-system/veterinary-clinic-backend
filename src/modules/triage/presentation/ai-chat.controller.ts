import { Body, Controller, HttpCode, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '@/shared/common/decorators/public.decorator';
import {
  AI_PREDICTION_PROVIDER,
  AiPredictionProvider,
} from '@/modules/triage/application/ports/ai-prediction.port';
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
  constructor(
    @Inject(AI_PREDICTION_PROVIDER)
    private readonly aiProvider: AiPredictionProvider,
  ) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  send(@Body() dto: SendChatMessageDto) {
    return this.aiProvider.chat({
      sessionId: dto.sessionId,
      message: dto.message,
      history: dto.history,
    });
  }
}
