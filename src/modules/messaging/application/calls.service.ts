import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { CallSession } from '@/modules/messaging/domain/entities/call-session.entity';
import { callLogText } from '@/modules/messaging/domain/message-preview';
import { CallMedia, CallStatus } from '@/shared/common/enums/messaging.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { MessagingService } from './messaging.service';
import { MessagingEventsPort } from './ports/messaging-events.port';

/** Đổ chuông bao lâu thì coi là cuộc gọi nhỡ. */
export const CALL_RING_TIMEOUT_MS = 30_000;

export type CallEndReason =
  | 'HANGUP'
  | 'CANCELLED'
  | 'REJECTED'
  | 'BUSY'
  | 'NO_ANSWER'
  | 'OFFLINE'
  | 'DISCONNECTED'
  | 'MEDIA_ERROR';

interface ActiveCall {
  id: string;
  conversationId: string;
  callerUserId: string;
  calleeUserId: string;
  media: CallMedia;
  status: CallStatus.RINGING | CallStatus.ACCEPTED;
  callerSocketId: string;
  calleeSocketId: string | null;
  answeredAt: Date | null;
  ringTimer: NodeJS.Timeout | null;
}

export interface IceServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

/**
 * Điều phối cuộc gọi WebRTC: máy chủ chỉ làm tổng đài (đổ chuông, nhận, từ chối, kết thúc)
 * và chuyển tín hiệu offer/answer/ICE giữa hai tab; âm thanh/hình ảnh đi thẳng giữa hai
 * trình duyệt. Trạng thái cuộc gọi đang diễn ra giữ trong bộ nhớ của tiến trình - chạy
 * nhiều tiến trình API thì cần thêm adapter Redis cho Socket.IO và chuyển bảng này ra Redis.
 */
@Injectable()
export class CallsService implements OnModuleDestroy {
  private readonly logger = new Logger(CallsService.name);
  private readonly active = new Map<string, ActiveCall>();

  constructor(
    @InjectRepository(CallSession) private readonly calls: Repository<CallSession>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly messaging: MessagingService,
    private readonly events: MessagingEventsPort,
    private readonly config: ConfigService,
  ) {}

  onModuleDestroy() {
    for (const call of this.active.values()) {
      if (call.ringTimer) clearTimeout(call.ringTimer);
    }
  }

  iceServers(): IceServerConfig[] {
    return this.config.get<IceServerConfig[]>('webrtc.iceServers') ?? [];
  }

  async invite(
    actor: AuthenticatedUser,
    socketId: string,
    input: { conversationId: string; media: CallMedia },
  ): Promise<{ callId: string; status: CallStatus; reason?: CallEndReason }> {
    if (!Object.values(CallMedia).includes(input.media)) {
      throw new BadRequestException('Kiểu cuộc gọi không hợp lệ');
    }
    const { me, ownerUserId, doctorUserId } = await this.messaging.loadMembershipForActor(
      actor,
      input.conversationId,
    );
    const calleeUserId = me.userId === ownerUserId ? doctorUserId : ownerUserId;

    if (this.findActiveCallOf(me.userId)) {
      throw new ConflictException('Bạn đang trong một cuộc gọi khác');
    }

    const session = await this.calls.save(
      this.calls.create({
        conversationId: input.conversationId,
        callerUserId: me.userId,
        calleeUserId,
        media: input.media,
        status: CallStatus.RINGING,
      }),
    );

    // Không ai để đổ chuông thì kết thúc ngay - người gọi biết lý do thay vì chờ 30 giây.
    if (this.findActiveCallOf(calleeUserId)) {
      await this.persistEnd(session, CallStatus.REJECTED, 'BUSY');
      return { callId: session.id, status: CallStatus.REJECTED, reason: 'BUSY' };
    }
    if (!this.events.isUserOnline(calleeUserId)) {
      await this.persistEnd(session, CallStatus.MISSED, 'OFFLINE');
      return { callId: session.id, status: CallStatus.MISSED, reason: 'OFFLINE' };
    }

    const call: ActiveCall = {
      id: session.id,
      conversationId: session.conversationId,
      callerUserId: me.userId,
      calleeUserId,
      media: input.media,
      status: CallStatus.RINGING,
      callerSocketId: socketId,
      calleeSocketId: null,
      answeredAt: null,
      ringTimer: null,
    };
    call.ringTimer = setTimeout(() => {
      void this.finish(call.id, CallStatus.MISSED, 'NO_ANSWER');
    }, CALL_RING_TIMEOUT_MS);
    call.ringTimer.unref?.();
    this.active.set(call.id, call);

    const caller = await this.users.findOne({ where: { id: me.userId } });
    this.events.emitToUsers([calleeUserId], 'call:incoming', {
      callId: call.id,
      conversationId: call.conversationId,
      media: call.media,
      caller: {
        userId: me.userId,
        fullName: caller?.fullName ?? '',
        avatarUrl: caller?.avatarUrl ?? null,
      },
    });
    // Các tab khác của người gọi cũng biết mình đang gọi đi (để không gọi chồng).
    this.events.emitToUsers([me.userId], 'call:outgoing', {
      callId: call.id,
      conversationId: call.conversationId,
      media: call.media,
      callerSocketId: socketId,
    });

    return { callId: call.id, status: CallStatus.RINGING };
  }

  async accept(userId: string, socketId: string, callId: string): Promise<{ callId: string }> {
    const call = this.requireActive(callId);
    if (call.calleeUserId !== userId) {
      throw new ForbiddenException('Chỉ người được gọi mới nhận được cuộc gọi');
    }
    if (call.status !== CallStatus.RINGING) {
      throw new ConflictException('Cuộc gọi đã được nhận ở nơi khác');
    }

    if (call.ringTimer) clearTimeout(call.ringTimer);
    call.ringTimer = null;
    call.status = CallStatus.ACCEPTED;
    call.calleeSocketId = socketId;
    call.answeredAt = new Date();
    await this.calls.update(call.id, { status: CallStatus.ACCEPTED, answeredAt: call.answeredAt });

    // Gửi cho cả hai phía: tab nhận máy bắt đầu kết nối, các tab khác của người được gọi
    // tắt chuông, người gọi bắt đầu tạo offer.
    this.events.emitToUsers([call.callerUserId, call.calleeUserId], 'call:accepted', {
      callId: call.id,
      callerSocketId: call.callerSocketId,
      calleeSocketId: socketId,
    });
    return { callId: call.id };
  }

  async reject(userId: string, callId: string): Promise<void> {
    const call = this.requireActive(callId);
    if (call.calleeUserId !== userId) {
      throw new ForbiddenException('Chỉ người được gọi mới từ chối được cuộc gọi');
    }
    if (call.status !== CallStatus.RINGING) {
      throw new ConflictException('Cuộc gọi không còn đổ chuông');
    }
    await this.finish(call.id, CallStatus.REJECTED, 'REJECTED');
  }

  async hangUp(userId: string, callId: string, reason: CallEndReason = 'HANGUP'): Promise<void> {
    const call = this.requireActive(callId);
    if (call.callerUserId !== userId && call.calleeUserId !== userId) {
      throw new ForbiddenException('Bạn không tham gia cuộc gọi này');
    }
    if (call.status === CallStatus.RINGING) {
      if (call.callerUserId === userId) {
        await this.finish(call.id, CallStatus.CANCELLED, 'CANCELLED');
      } else {
        await this.finish(call.id, CallStatus.REJECTED, 'REJECTED');
      }
      return;
    }
    await this.finish(call.id, CallStatus.ENDED, reason === 'MEDIA_ERROR' ? reason : 'HANGUP');
  }

  /**
   * Chuyển một gói tín hiệu WebRTC sang đầu bên kia. Chỉ hai kết nối đã tham gia cuộc gọi
   * mới được gửi và nhận - tab khác của cùng người dùng không chen vào được.
   */
  relaySignal(userId: string, socketId: string, callId: string, data: unknown): void {
    const call = this.requireActive(callId);
    if (call.status !== CallStatus.ACCEPTED || !call.calleeSocketId) {
      throw new ConflictException('Cuộc gọi chưa được nhận');
    }
    let target: string;
    if (userId === call.callerUserId && socketId === call.callerSocketId) {
      target = call.calleeSocketId;
    } else if (userId === call.calleeUserId && socketId === call.calleeSocketId) {
      target = call.callerSocketId;
    } else {
      throw new ForbiddenException('Kết nối này không tham gia cuộc gọi');
    }
    this.events.emitToSocket(target, 'call:signal', { callId, data });
  }

  /** Một tab đóng/mất mạng giữa chừng: kết thúc mọi cuộc gọi mà tab đó đang giữ. */
  async handleDisconnect(socketId: string): Promise<void> {
    for (const call of [...this.active.values()]) {
      if (call.callerSocketId === socketId) {
        await this.finish(
          call.id,
          call.status === CallStatus.RINGING ? CallStatus.CANCELLED : CallStatus.ENDED,
          'DISCONNECTED',
        );
      } else if (call.calleeSocketId === socketId) {
        await this.finish(call.id, CallStatus.ENDED, 'DISCONNECTED');
      }
    }
  }

  /** Cho test và cho gateway: cuộc gọi đang diễn ra của một người (nếu có). */
  findActiveCallOf(userId: string): ActiveCall | undefined {
    for (const call of this.active.values()) {
      if (call.callerUserId === userId || call.calleeUserId === userId) return call;
    }
    return undefined;
  }

  private requireActive(callId: string): ActiveCall {
    const call = this.active.get(callId);
    if (!call) throw new NotFoundException('Cuộc gọi đã kết thúc');
    return call;
  }

  private async finish(callId: string, status: CallStatus, reason: CallEndReason): Promise<void> {
    const call = this.active.get(callId);
    if (!call) return;
    this.active.delete(callId);
    if (call.ringTimer) clearTimeout(call.ringTimer);

    this.events.emitToUsers([call.callerUserId, call.calleeUserId], 'call:ended', {
      callId,
      status,
      reason,
    });

    try {
      const session = await this.calls.findOne({ where: { id: callId } });
      if (session) await this.persistEnd(session, status, reason);
    } catch (error) {
      this.logger.error(`Không ghi được kết thúc cuộc gọi ${callId}: ${(error as Error).message}`);
    }
  }

  private async persistEnd(
    session: CallSession,
    status: CallStatus,
    reason: CallEndReason,
  ): Promise<void> {
    const endedAt = new Date();
    session.status = status;
    session.endedAt = endedAt;
    session.endReason = reason;
    await this.calls.update(session.id, { status, endedAt, endReason: reason });

    const seconds = session.answeredAt
      ? (endedAt.getTime() - new Date(session.answeredAt).getTime()) / 1000
      : 0;
    await this.messaging.recordCallLog(session, callLogText(session.media, status, seconds));
  }
}
