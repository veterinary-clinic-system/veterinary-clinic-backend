import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Conversation } from '@/modules/messaging/domain/entities/conversation.entity';
import { Message } from '@/modules/messaging/domain/entities/message.entity';
import { CallSession } from '@/modules/messaging/domain/entities/call-session.entity';
import { messagePreview } from '@/modules/messaging/domain/message-preview';
import { Role } from '@/shared/common/enums/role.enum';
import {
  MESSAGING_ELIGIBLE_APPOINTMENT_STATUSES,
  MessageKind,
} from '@/shared/common/enums/messaging.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { MessagingEventsPort } from './ports/messaging-events.port';

export const MESSAGE_PAGE_DEFAULT = 30;
export const MESSAGE_PAGE_MAX = 100;

/** Người đang thao tác, đã quy về một phía của cuộc trò chuyện. */
export type Participant =
  { side: 'OWNER'; userId: string } | { side: 'DOCTOR'; userId: string; doctorId: string };

export interface CounterpartView {
  /** Id để mở cuộc trò chuyện: doctorId nếu đối phương là bác sĩ, userId nếu là chủ nuôi. */
  id: string;
  userId: string;
  role: 'DOCTOR' | 'PET_OWNER';
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
}

export interface ConversationView {
  id: string;
  counterpart: CounterpartView;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  /** Lúc đối phương đọc lần cuối - để hiện "Đã xem" dưới tin của mình. */
  counterpartLastReadAt: Date | null;
  createdAt: Date;
}

export interface ContactView {
  counterpart: CounterpartView;
  petNames: string[];
  lastVisitAt: Date | null;
  conversationId: string | null;
}

export interface MessageView {
  id: string;
  conversationId: string;
  senderUserId: string;
  kind: MessageKind;
  body: string | null;
  imageUrl: string | null;
  createdAt: Date;
  call: {
    id: string;
    media: string;
    status: string;
    callerUserId: string;
    answeredAt: Date | null;
    endedAt: Date | null;
    endReason: string | null;
  } | null;
}

export interface ConversationMembers {
  conversation: Conversation;
  ownerUserId: string;
  doctorUserId: string;
}

interface ConversationRow {
  id: string;
  created_at: Date;
  last_message_at: Date | null;
  last_message_preview: string | null;
  owner_id: string;
  owner_name: string;
  owner_avatar: string | null;
  owner_phone: string | null;
  owner_last_read_at: Date | null;
  doctor_id: string;
  doctor_user_id: string;
  doctor_name: string;
  doctor_avatar: string | null;
  doctor_last_read_at: Date | null;
  unread_count: number;
}

interface ContactRow {
  counterpart_id: string;
  counterpart_user_id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  pet_names: string[];
  last_visit_at: Date | null;
  conversation_id: string | null;
}

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(Doctor) private readonly doctors: Repository<Doctor>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly events: MessagingEventsPort,
  ) {}

  async resolveParticipant(actor: AuthenticatedUser): Promise<Participant> {
    if (actor.role === Role.PET_OWNER) {
      return { side: 'OWNER', userId: actor.userId };
    }
    if (actor.role === Role.DOCTOR) {
      const doctor = await this.doctors.findOne({ where: { userId: actor.userId, active: true } });
      if (!doctor) {
        throw new ForbiddenException('Tài khoản bác sĩ chưa có hồ sơ bác sĩ đang hoạt động');
      }
      return { side: 'DOCTOR', userId: actor.userId, doctorId: doctor.id };
    }
    throw new ForbiddenException('Chỉ chủ thú cưng và bác sĩ mới dùng được tin nhắn');
  }

  /**
   * Chủ nuôi chỉ nhắn được với bác sĩ đã/đang khám cho bé của mình - và ngược lại, bác sĩ
   * chỉ mở được cuộc trò chuyện với chủ của bé mình đã/đang khám.
   */
  async isEligiblePair(ownerUserId: string, doctorId: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `
      SELECT 1
      FROM appointments a
      JOIN pets p ON p.id = a.pet_id AND p.deleted_at IS NULL
      JOIN doctors d ON d.id = a.doctor_id AND d.active = true AND d.deleted_at IS NULL
      WHERE p.owner_id = $1
        AND a.doctor_id = $2
        AND a.deleted_at IS NULL
        AND a.status = ANY($3::appointments_status_enum[])
      LIMIT 1
      `,
      [ownerUserId, doctorId, MESSAGING_ELIGIBLE_APPOINTMENT_STATUSES],
    );
    return rows.length > 0;
  }

  async listContacts(actor: AuthenticatedUser): Promise<ContactView[]> {
    const me = await this.resolveParticipant(actor);
    const statuses = MESSAGING_ELIGIBLE_APPOINTMENT_STATUSES;

    const rows: ContactRow[] =
      me.side === 'OWNER'
        ? await this.dataSource.query(
            `
            SELECT d.id AS counterpart_id, d.user_id AS counterpart_user_id,
                   d.full_name, d.avatar_url, NULL AS phone,
                   array_agg(DISTINCT p.name ORDER BY p.name) AS pet_names,
                   max(a.start_at) AS last_visit_at,
                   c.id AS conversation_id
            FROM appointments a
            JOIN pets p ON p.id = a.pet_id AND p.deleted_at IS NULL
            JOIN doctors d ON d.id = a.doctor_id AND d.active = true AND d.deleted_at IS NULL
            LEFT JOIN conversations c
              ON c.owner_id = p.owner_id AND c.doctor_id = d.id AND c.deleted_at IS NULL
            WHERE p.owner_id = $1
              AND a.deleted_at IS NULL
              AND a.status = ANY($2::appointments_status_enum[])
            GROUP BY d.id, c.id
            ORDER BY max(a.start_at) DESC
            `,
            [me.userId, statuses],
          )
        : await this.dataSource.query(
            `
            SELECT u.id AS counterpart_id, u.id AS counterpart_user_id,
                   u.full_name, u.avatar_url, u.phone,
                   array_agg(DISTINCT p.name ORDER BY p.name) AS pet_names,
                   max(a.start_at) AS last_visit_at,
                   c.id AS conversation_id
            FROM appointments a
            JOIN pets p ON p.id = a.pet_id AND p.deleted_at IS NULL
            JOIN users u ON u.id = p.owner_id AND u.active = true AND u.deleted_at IS NULL
            LEFT JOIN conversations c
              ON c.owner_id = u.id AND c.doctor_id = a.doctor_id AND c.deleted_at IS NULL
            WHERE a.doctor_id = $1
              AND a.deleted_at IS NULL
              AND a.status = ANY($2::appointments_status_enum[])
            GROUP BY u.id, c.id
            ORDER BY max(a.start_at) DESC
            `,
            [me.doctorId, statuses],
          );

    return rows.map((row) => ({
      counterpart: {
        id: row.counterpart_id,
        userId: row.counterpart_user_id,
        role: me.side === 'OWNER' ? 'DOCTOR' : 'PET_OWNER',
        fullName: row.full_name,
        avatarUrl: row.avatar_url,
        phone: row.phone,
      },
      petNames: row.pet_names ?? [],
      lastVisitAt: row.last_visit_at,
      conversationId: row.conversation_id,
    }));
  }

  /** Mở (hoặc lấy lại) cuộc trò chuyện với một bác sĩ (phía chủ nuôi) / một chủ nuôi (phía bác sĩ). */
  async openConversation(
    actor: AuthenticatedUser,
    target: { doctorId?: string; ownerId?: string },
  ): Promise<ConversationView> {
    const me = await this.resolveParticipant(actor);
    let ownerUserId: string;
    let doctorId: string;

    if (me.side === 'OWNER') {
      if (!target.doctorId) throw new BadRequestException('Thiếu bác sĩ cần nhắn tin');
      ownerUserId = me.userId;
      doctorId = target.doctorId;
    } else {
      if (!target.ownerId) throw new BadRequestException('Thiếu chủ thú cưng cần nhắn tin');
      ownerUserId = target.ownerId;
      doctorId = me.doctorId;
    }

    if (!(await this.isEligiblePair(ownerUserId, doctorId))) {
      throw new ForbiddenException(
        me.side === 'OWNER'
          ? 'Bạn chỉ nhắn tin được với bác sĩ đã hoặc đang khám cho thú cưng của mình'
          : 'Bạn chỉ nhắn tin được với chủ của thú cưng mình đã hoặc đang khám',
      );
    }

    // Hai bên có thể bấm "Nhắn tin" cùng lúc: chèn bỏ qua trùng rồi đọc lại theo khoá duy nhất.
    await this.conversations
      .createQueryBuilder()
      .insert()
      .into(Conversation)
      .values({ ownerId: ownerUserId, doctorId })
      .orIgnore()
      .execute();
    const conversation = await this.conversations.findOneOrFail({
      where: { ownerId: ownerUserId, doctorId },
    });

    const [view] = await this.queryConversations(me, conversation.id);
    return view;
  }

  async listConversations(actor: AuthenticatedUser): Promise<ConversationView[]> {
    const me = await this.resolveParticipant(actor);
    return this.queryConversations(me);
  }

  async getConversation(
    actor: AuthenticatedUser,
    conversationId: string,
  ): Promise<ConversationView> {
    const me = await this.resolveParticipant(actor);
    const [view] = await this.queryConversations(me, conversationId);
    if (!view) throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    return view;
  }

  async unreadTotal(actor: AuthenticatedUser): Promise<{ unreadCount: number }> {
    const me = await this.resolveParticipant(actor);
    const list = await this.queryConversations(me);
    return { unreadCount: list.reduce((sum, item) => sum + item.unreadCount, 0) };
  }

  /**
   * Nạp cuộc trò chuyện và kiểm tra người thao tác là một trong hai bên. Cuộc trò chuyện
   * của người khác trả 404 chứ không 403 - không xác nhận là nó tồn tại.
   */
  async loadMembership(me: Participant, conversationId: string): Promise<ConversationMembers> {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId },
      relations: { doctor: true },
    });
    const isMember =
      conversation &&
      (me.side === 'OWNER'
        ? conversation.ownerId === me.userId
        : conversation.doctorId === me.doctorId);
    if (!conversation || !isMember || !conversation.doctor) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }
    return {
      conversation,
      ownerUserId: conversation.ownerId,
      doctorUserId: conversation.doctor.userId,
    };
  }

  async loadMembershipForActor(
    actor: AuthenticatedUser,
    conversationId: string,
  ): Promise<ConversationMembers & { me: Participant }> {
    const me = await this.resolveParticipant(actor);
    return { me, ...(await this.loadMembership(me, conversationId)) };
  }

  async listMessages(
    actor: AuthenticatedUser,
    conversationId: string,
    options: { before?: string; limit?: number } = {},
  ): Promise<MessageView[]> {
    const me = await this.resolveParticipant(actor);
    await this.loadMembership(me, conversationId);

    const limit = Math.min(Math.max(options.limit ?? MESSAGE_PAGE_DEFAULT, 1), MESSAGE_PAGE_MAX);
    const query = this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.call', 'call')
      .where('m.conversationId = :conversationId', { conversationId })
      .orderBy('m.createdAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(limit);
    if (options.before) {
      const before = new Date(options.before);
      if (Number.isNaN(before.getTime()))
        throw new BadRequestException('Mốc thời gian không hợp lệ');
      query.andWhere('m.createdAt < :before', { before });
    }

    const rows = await query.getMany();
    return rows.reverse().map(toMessageView);
  }

  async sendMessage(
    actor: AuthenticatedUser,
    conversationId: string,
    input: { body?: string | null; imageUrl?: string | null },
  ): Promise<MessageView> {
    const me = await this.resolveParticipant(actor);
    const members = await this.loadMembership(me, conversationId);

    const body = input.body?.trim() || null;
    const imageUrl = input.imageUrl?.trim() || null;
    if (!body && !imageUrl) {
      throw new BadRequestException('Tin nhắn cần có nội dung hoặc hình ảnh');
    }

    const kind = imageUrl ? MessageKind.IMAGE : MessageKind.TEXT;
    const saved = await this.messages.save(
      this.messages.create({
        conversationId,
        senderUserId: me.userId,
        kind,
        body,
        imageUrl,
        callId: null,
      }),
    );

    // Người gửi hiển nhiên đã đọc tới tin của chính mình.
    await this.conversations.update(conversationId, {
      lastMessageAt: saved.createdAt,
      lastMessagePreview: messagePreview(kind, body),
      ...(me.side === 'OWNER'
        ? { ownerLastReadAt: saved.createdAt }
        : { doctorLastReadAt: saved.createdAt }),
    });

    const view = toMessageView({ ...saved, call: null });
    this.events.emitToUsers([members.ownerUserId, members.doctorUserId], 'message:new', view);
    return view;
  }

  async markRead(actor: AuthenticatedUser, conversationId: string): Promise<{ readAt: Date }> {
    const me = await this.resolveParticipant(actor);
    const members = await this.loadMembership(me, conversationId);
    const readAt = new Date();

    await this.conversations.update(
      conversationId,
      me.side === 'OWNER' ? { ownerLastReadAt: readAt } : { doctorLastReadAt: readAt },
    );

    this.events.emitToUsers([members.ownerUserId, members.doctorUserId], 'conversation:read', {
      conversationId,
      readerUserId: me.userId,
      readAt,
    });
    return { readAt };
  }

  /** Ghi một dòng nhật ký cuộc gọi vào cuộc trò chuyện (gọi từ CallsService khi cuộc gọi kết thúc). */
  async recordCallLog(call: CallSession, text: string): Promise<MessageView> {
    const conversation = await this.conversations.findOne({
      where: { id: call.conversationId },
      relations: { doctor: true },
    });
    const saved = await this.messages.save(
      this.messages.create({
        conversationId: call.conversationId,
        senderUserId: call.callerUserId,
        kind: MessageKind.CALL,
        body: text,
        imageUrl: null,
        callId: call.id,
      }),
    );
    await this.conversations.update(call.conversationId, {
      lastMessageAt: saved.createdAt,
      lastMessagePreview: messagePreview(MessageKind.CALL, text),
    });

    const view = toMessageView({ ...saved, call });
    if (conversation?.doctor) {
      this.events.emitToUsers(
        [conversation.ownerId, conversation.doctor.userId],
        'message:new',
        view,
      );
    }
    return view;
  }

  async listCalls(actor: AuthenticatedUser, conversationId: string): Promise<CallSession[]> {
    const me = await this.resolveParticipant(actor);
    await this.loadMembership(me, conversationId);
    return this.dataSource.getRepository(CallSession).find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private async queryConversations(
    me: Participant,
    conversationId?: string,
  ): Promise<ConversationView[]> {
    // Tên cột chọn từ một bảng cố định theo phía - không bao giờ lấy từ dữ liệu người dùng.
    const myReadColumn = me.side === 'OWNER' ? 'owner_last_read_at' : 'doctor_last_read_at';
    const sideFilter = me.side === 'OWNER' ? 'c.owner_id = $1' : 'c.doctor_id = $1';
    const params: unknown[] = [me.side === 'OWNER' ? me.userId : me.doctorId, me.userId];
    if (conversationId) params.push(conversationId);

    const rows: ConversationRow[] = await this.dataSource.query(
      `
      SELECT c.id, c.created_at, c.last_message_at, c.last_message_preview,
             c.owner_id, u.full_name AS owner_name, u.avatar_url AS owner_avatar,
             u.phone AS owner_phone, c.owner_last_read_at,
             c.doctor_id, d.user_id AS doctor_user_id, d.full_name AS doctor_name,
             d.avatar_url AS doctor_avatar, c.doctor_last_read_at,
             (
               SELECT count(*)::int FROM messages m
               WHERE m.conversation_id = c.id
                 AND m.sender_user_id <> $2
                 AND m.created_at > COALESCE(c.${myReadColumn}, '-infinity'::timestamptz)
             ) AS unread_count
      FROM conversations c
      JOIN users u ON u.id = c.owner_id
      JOIN doctors d ON d.id = c.doctor_id
      WHERE ${sideFilter}
        AND c.deleted_at IS NULL
        ${conversationId ? 'AND c.id = $3' : ''}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
      `,
      params,
    );

    return rows.map((row) => ({
      id: row.id,
      counterpart:
        me.side === 'OWNER'
          ? {
              id: row.doctor_id,
              userId: row.doctor_user_id,
              role: 'DOCTOR',
              fullName: row.doctor_name,
              avatarUrl: row.doctor_avatar,
              phone: null,
            }
          : {
              id: row.owner_id,
              userId: row.owner_id,
              role: 'PET_OWNER',
              fullName: row.owner_name,
              avatarUrl: row.owner_avatar,
              phone: row.owner_phone,
            },
      lastMessageAt: row.last_message_at,
      lastMessagePreview: row.last_message_preview,
      unreadCount: Number(row.unread_count) || 0,
      counterpartLastReadAt: me.side === 'OWNER' ? row.doctor_last_read_at : row.owner_last_read_at,
      createdAt: row.created_at,
    }));
  }
}

function toMessageView(message: Message & { call?: CallSession | null }): MessageView {
  const call = message.call ?? null;
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderUserId: message.senderUserId,
    kind: message.kind,
    body: message.body,
    imageUrl: message.imageUrl,
    createdAt: message.createdAt,
    call: call
      ? {
          id: call.id,
          media: call.media,
          status: call.status,
          callerUserId: call.callerUserId,
          answeredAt: call.answeredAt,
          endedAt: call.endedAt,
          endReason: call.endReason,
        }
      : null,
  };
}
