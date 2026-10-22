import { CallActionsController } from '@/modules/messaging/presentation/call-actions.controller';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Conversation } from '@/modules/messaging/domain/entities/conversation.entity';
import { Message } from '@/modules/messaging/domain/entities/message.entity';
import { CallSession } from '@/modules/messaging/domain/entities/call-session.entity';
import {
  CallsService,
  MessagingEventsPort,
  MessagingPushPort,
  MessagingService,
} from '@/modules/messaging/application';
import { NotificationModule } from '@/modules/notification/notification.module';
import { PushNotificationsService } from '@/modules/notification/application';
import { MessagingController } from '@/modules/messaging/presentation/messaging.controller';
import { MessagingGateway } from '@/modules/messaging/presentation/messaging.gateway';
import { MessagingSocketHub } from '@/modules/messaging/presentation/messaging-socket.hub';

/**
 * Nhắn tin + gọi thoại/video giữa chủ thú cưng và bác sĩ. Chỉ đọc lịch hẹn/thú cưng để
 * kiểm tra quyền (bằng SQL). Phụ thuộc duy nhất ra ngoài là push (module notification),
 * đi qua cổng MessagingPushPort.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, CallSession, Doctor, User]),
    NotificationModule,
    // Chỉ dùng để xác minh access token lúc bắt tay socket; secret truyền khi verify.
    JwtModule.register({}),
  ],
  controllers: [MessagingController, CallActionsController],
  providers: [
    MessagingService,
    CallsService,
    MessagingSocketHub,
    { provide: MessagingEventsPort, useExisting: MessagingSocketHub },
    { provide: MessagingPushPort, useExisting: PushNotificationsService },
    MessagingGateway,
  ],
  exports: [MessagingService],
})
export class MessagingModule {}
