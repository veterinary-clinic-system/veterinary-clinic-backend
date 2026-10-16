import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { CallsService, MessagingService } from '@/modules/messaging/application';
import { ListMessagesQueryDto, OpenConversationDto, SendMessageDto } from './dto/messaging.dto';

/**
 * Nhắn tin giữa chủ thú cưng và bác sĩ. Tin nhắn mới và trạng thái đã đọc còn được đẩy
 * realtime qua namespace Socket.IO /messaging; REST là nguồn sự thật khi tải lại trang.
 */
@ApiTags('messaging')
@ApiBearerAuth()
@Controller('messaging')
@Roles(Role.PET_OWNER, Role.DOCTOR)
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly calls: CallsService,
  ) {}

  @Get('contacts')
  contacts(@CurrentUser() actor: AuthenticatedUser) {
    return this.messaging.listContacts(actor);
  }

  @Get('conversations')
  conversations(@CurrentUser() actor: AuthenticatedUser) {
    return this.messaging.listConversations(actor);
  }

  @Post('conversations')
  open(@CurrentUser() actor: AuthenticatedUser, @Body() dto: OpenConversationDto) {
    return this.messaging.openConversation(actor, dto);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return this.messaging.unreadTotal(actor);
  }

  @Get('rtc-config')
  rtcConfig() {
    return { iceServers: this.calls.iceServers() };
  }

  @Get('conversations/:id')
  conversation(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.messaging.getConversation(actor, id);
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messaging.listMessages(actor, id, query);
  }

  @Post('conversations/:id/messages')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  send(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messaging.sendMessage(actor, id, dto);
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  read(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.messaging.markRead(actor, id);
  }

  @Get('conversations/:id/calls')
  callHistory(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.messaging.listCalls(actor, id);
  }
}
