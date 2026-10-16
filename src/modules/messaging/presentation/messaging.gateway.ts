import { HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { CallsService } from '@/modules/messaging/application';
import { CallMedia } from '@/shared/common/enums/messaging.enum';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { MessagingSocketHub, userRoom } from './messaging-socket.hub';

const MESSAGING_ROLES: readonly Role[] = [Role.PET_OWNER, Role.DOCTOR];

type Ack<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; error: string };

interface SocketData {
  user?: AuthenticatedUser;
}

/**
 * Kênh realtime riêng cho nhắn tin + tín hiệu cuộc gọi. Khác namespace /realtime (phát
 * công khai cho màn hình lịch hẹn/hàng chờ), ở đây mọi kết nối phải xác thực bằng access
 * token ngay lúc bắt tay và chỉ nhận sự kiện của chính mình qua room user:{id}.
 */
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/messaging',
})
export class MessagingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private readonly hub: MessagingSocketHub,
    private readonly calls: CallsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  afterInit(namespace: Namespace) {
    this.hub.attach(namespace);
    // Xác thực trong middleware để không sự kiện nào lọt vào trước khi biết người gửi là ai.
    namespace.use((socket, next) => {
      this.authenticate(socket)
        .then((user) => {
          (socket.data as SocketData).user = user;
          next();
        })
        .catch((error: Error) => next(new Error(error.message || 'UNAUTHORIZED')));
    });
  }

  async handleConnection(client: Socket) {
    const user = (client.data as SocketData).user;
    if (!user) {
      client.disconnect(true);
      return;
    }
    await client.join(userRoom(user.userId));
  }

  async handleDisconnect(client: Socket) {
    await this.calls.handleDisconnect(client.id).catch((error: Error) => {
      this.logger.error(`Lỗi khi đóng cuộc gọi của socket ${client.id}: ${error.message}`);
    });
  }

  @SubscribeMessage('call:invite')
  invite(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string; media?: CallMedia },
  ): Promise<Ack> {
    return this.run(client, async (user) => {
      if (!body?.conversationId) throw new Error('Thiếu cuộc trò chuyện');
      return this.calls.invite(user, client.id, {
        conversationId: body.conversationId,
        media: body.media ?? CallMedia.AUDIO,
      });
    });
  }

  @SubscribeMessage('call:accept')
  accept(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId?: string },
  ): Promise<Ack> {
    return this.run(client, (user) =>
      this.calls.accept(user.userId, client.id, String(body?.callId)),
    );
  }

  @SubscribeMessage('call:reject')
  reject(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId?: string },
  ): Promise<Ack> {
    return this.run(client, async (user) => {
      await this.calls.reject(user.userId, String(body?.callId));
      return {};
    });
  }

  @SubscribeMessage('call:end')
  end(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId?: string; reason?: 'HANGUP' | 'MEDIA_ERROR' },
  ): Promise<Ack> {
    return this.run(client, async (user) => {
      await this.calls.hangUp(
        user.userId,
        String(body?.callId),
        body?.reason === 'MEDIA_ERROR' ? 'MEDIA_ERROR' : 'HANGUP',
      );
      return {};
    });
  }

  @SubscribeMessage('call:signal')
  signal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId?: string; data?: unknown },
  ): Promise<Ack> {
    return this.run(client, async (user) => {
      this.calls.relaySignal(user.userId, client.id, String(body?.callId), body?.data);
      return {};
    });
  }

  private async run<T extends object>(
    client: Socket,
    action: (user: AuthenticatedUser) => Promise<T>,
  ): Promise<Ack> {
    const user = (client.data as SocketData).user;
    if (!user) return { ok: false, error: 'Chưa xác thực' };
    try {
      return { ok: true, ...(await action(user)) };
    } catch (error) {
      const message =
        error instanceof HttpException ? error.message : (error as Error).message || 'Lỗi máy chủ';
      return { ok: false, error: message };
    }
  }

  private async authenticate(socket: Socket): Promise<AuthenticatedUser> {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    const header = socket.handshake.headers.authorization;
    const token =
      typeof auth?.token === 'string'
        ? auth.token
        : header?.startsWith('Bearer ')
          ? header.slice(7)
          : null;
    if (!token) throw new Error('UNAUTHORIZED');

    let sub: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
      sub = payload.sub;
    } catch {
      throw new Error('TOKEN_EXPIRED');
    }

    const user = await this.users.findOne({ where: { id: sub } });
    if (!user || !user.active) throw new Error('UNAUTHORIZED');
    if (!MESSAGING_ROLES.includes(user.role)) throw new Error('FORBIDDEN');
    return { userId: user.id, phone: user.phone, role: user.role, branchId: user.branchId };
  }
}
