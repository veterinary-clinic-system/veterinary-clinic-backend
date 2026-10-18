import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@/shared/common/enums/role.enum';
import { MessageKind } from '@/shared/common/enums/messaging.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { MessagingService } from './messaging.service';

const OWNER: AuthenticatedUser = {
  userId: 'owner-user',
  phone: '0911111111',
  role: Role.PET_OWNER,
  branchId: null,
};
const OTHER_OWNER: AuthenticatedUser = { ...OWNER, userId: 'other-owner-user' };
const DOCTOR: AuthenticatedUser = {
  userId: 'doctor-user',
  phone: '0900000010',
  role: Role.DOCTOR,
  branchId: 'branch-1',
};
const OTHER_DOCTOR: AuthenticatedUser = { ...DOCTOR, userId: 'other-doctor-user' };
const RECEPTIONIST: AuthenticatedUser = { ...DOCTOR, userId: 'rec-user', role: Role.RECEPTIONIST };

const DOCTOR_PROFILES: Record<string, { id: string; userId: string }> = {
  'doctor-user': { id: 'doctor-1', userId: 'doctor-user' },
  'other-doctor-user': { id: 'doctor-2', userId: 'other-doctor-user' },
};

const CONVERSATION = {
  id: 'conv-1',
  ownerId: 'owner-user',
  doctorId: 'doctor-1',
  doctor: { id: 'doctor-1', userId: 'doctor-user' },
};

function conversationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv-1',
    created_at: new Date('2026-10-01T00:00:00Z'),
    last_message_at: null,
    last_message_preview: null,
    owner_id: 'owner-user',
    owner_name: 'Nguyễn Minh Anh',
    owner_avatar: null,
    owner_phone: '0911111111',
    owner_last_read_at: null,
    doctor_id: 'doctor-1',
    doctor_user_id: 'doctor-user',
    doctor_name: 'BS. Trần Minh Đức',
    doctor_avatar: null,
    doctor_last_read_at: null,
    unread_count: 0,
    ...overrides,
  };
}

function setup(options: { eligible?: boolean } = {}) {
  const eligible = options.eligible ?? true;

  const insertBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ identifiers: [] }),
  };
  const conversations = {
    createQueryBuilder: jest.fn(() => insertBuilder),
    findOneOrFail: jest.fn().mockResolvedValue(CONVERSATION),
    findOne: jest.fn().mockResolvedValue(CONVERSATION),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const messageQuery = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const messages = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({
      id: 'msg-1',
      createdAt: new Date('2026-10-16T08:00:00Z'),
      ...value,
    })),
    createQueryBuilder: jest.fn(() => messageQuery),
  };

  const doctors = {
    findOne: jest.fn(
      async ({ where }: { where: { userId: string } }) => DOCTOR_PROFILES[where.userId] ?? null,
    ),
  };

  const dataSource = {
    query: jest.fn<Promise<unknown[]>, [string, unknown[]?]>(async (sql) => {
      if (sql.includes('SELECT 1')) return eligible ? [{ '?column?': 1 }] : [];
      if (sql.includes('FROM conversations c')) return [conversationRow()];
      return [];
    }),
    getRepository: jest.fn(),
  };

  const events = {
    emitToUsers: jest.fn(),
    emitToSocket: jest.fn(),
    isUserOnline: jest.fn().mockReturnValue(true),
  };

  const service = new MessagingService(
    conversations as never,
    messages as never,
    doctors as never,
    dataSource as never,
    events,
    { sendToUser: jest.fn(() => Promise.resolve()) } as never,
  );
  return { service, conversations, messages, messageQuery, dataSource, events, insertBuilder };
}

describe('MessagingService - phân quyền', () => {
  it('chặn vai trò không phải chủ nuôi / bác sĩ', async () => {
    const { service } = setup();
    await expect(service.listConversations(RECEPTIONIST)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('chặn bác sĩ chưa có hồ sơ bác sĩ đang hoạt động', async () => {
    const { service } = setup();
    await expect(
      service.listConversations({ ...DOCTOR, userId: 'no-profile' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('chủ nuôi không mở được cuộc trò chuyện với bác sĩ chưa từng khám cho bé', async () => {
    const { service, insertBuilder } = setup({ eligible: false });
    await expect(service.openConversation(OWNER, { doctorId: 'doctor-1' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(insertBuilder.execute).not.toHaveBeenCalled();
  });

  it('kiểm tra quyền theo đúng cặp chủ nuôi - bác sĩ, kể cả khi bác sĩ là người mở', async () => {
    const { service, dataSource } = setup();
    await service.openConversation(DOCTOR, { ownerId: 'owner-user' });

    const eligibilityCall = dataSource.query.mock.calls.find(([sql]) => sql.includes('SELECT 1'));
    expect(eligibilityCall?.[1]).toEqual([
      'owner-user',
      'doctor-1',
      ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'],
    ]);
  });

  it('chủ nuôi phải nói rõ bác sĩ; không dùng ownerId để mạo danh chủ khác', async () => {
    const { service, insertBuilder } = setup();
    await expect(
      service.openConversation(OWNER, { ownerId: 'other-owner-user' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.openConversation(OWNER, { doctorId: 'doctor-1', ownerId: 'other-owner-user' });
    expect(insertBuilder.values).toHaveBeenCalledWith({
      ownerId: 'owner-user',
      doctorId: 'doctor-1',
    });
  });

  it('bác sĩ khác không đọc được tin nhắn của cuộc trò chuyện không phải của mình (404)', async () => {
    const { service, messages } = setup();
    await expect(service.listMessages(OTHER_DOCTOR, 'conv-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(messages.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('chủ nuôi khác không gửi được tin vào cuộc trò chuyện của người khác', async () => {
    const { service, messages, events } = setup();
    await expect(
      service.sendMessage(OTHER_OWNER, 'conv-1', { body: 'Xin chào' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(messages.save).not.toHaveBeenCalled();
    expect(events.emitToUsers).not.toHaveBeenCalled();
  });

  it('danh sách cuộc trò chuyện của bác sĩ lọc theo doctorId, của chủ nuôi lọc theo ownerId', async () => {
    const { service, dataSource } = setup();
    await service.listConversations(DOCTOR);
    await service.listConversations(OWNER);

    const [doctorSql, doctorParams] = dataSource.query.mock.calls[0];
    expect(doctorSql).toContain('c.doctor_id = $1');
    expect(doctorParams?.[0]).toBe('doctor-1');
    const [ownerSql, ownerParams] = dataSource.query.mock.calls[1];
    expect(ownerSql).toContain('c.owner_id = $1');
    expect(ownerParams?.[0]).toBe('owner-user');
  });
});

describe('MessagingService - luồng tin nhắn', () => {
  it('gửi tin văn bản: lưu, cập nhật xem trước, đánh dấu người gửi đã đọc, đẩy realtime cho cả hai', async () => {
    const { service, messages, conversations, events } = setup();
    const view = await service.sendMessage(OWNER, 'conv-1', {
      body: '  Bé ăn ít hơn từ hôm qua  ',
    });

    expect(messages.save).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        senderUserId: 'owner-user',
        kind: MessageKind.TEXT,
        body: 'Bé ăn ít hơn từ hôm qua',
        imageUrl: null,
      }),
    );
    expect(conversations.update).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        lastMessagePreview: 'Bé ăn ít hơn từ hôm qua',
        ownerLastReadAt: view.createdAt,
      }),
    );
    expect(events.emitToUsers).toHaveBeenCalledWith(
      ['owner-user', 'doctor-user'],
      'message:new',
      expect.objectContaining({ id: 'msg-1', kind: MessageKind.TEXT }),
    );
  });

  it('tin có ảnh được lưu loại IMAGE với xem trước [Hình ảnh]', async () => {
    const { service, messages, conversations } = setup();
    await service.sendMessage(DOCTOR, 'conv-1', { imageUrl: 'https://res.cloudinary.com/x/a.jpg' });

    expect(messages.save).toHaveBeenCalledWith(
      expect.objectContaining({ kind: MessageKind.IMAGE, senderUserId: 'doctor-user' }),
    );
    expect(conversations.update).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        lastMessagePreview: '[Hình ảnh]',
        doctorLastReadAt: expect.any(Date),
      }),
    );
  });

  it('từ chối tin rỗng', async () => {
    const { service, messages } = setup();
    await expect(service.sendMessage(OWNER, 'conv-1', { body: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(messages.save).not.toHaveBeenCalled();
  });

  it('đánh dấu đã đọc cập nhật đúng phía và báo cho phía kia', async () => {
    const { service, conversations, events } = setup();
    await service.markRead(DOCTOR, 'conv-1');

    expect(conversations.update).toHaveBeenCalledWith('conv-1', {
      doctorLastReadAt: expect.any(Date),
    });
    expect(events.emitToUsers).toHaveBeenCalledWith(
      ['owner-user', 'doctor-user'],
      'conversation:read',
      expect.objectContaining({ conversationId: 'conv-1', readerUserId: 'doctor-user' }),
    );
  });

  it('số chưa đọc tính theo mốc đã đọc của chính người xem', async () => {
    const { service, dataSource } = setup();
    dataSource.query.mockResolvedValueOnce([
      conversationRow({ unread_count: 2 }),
      conversationRow({ id: 'conv-2', unread_count: 3 }),
    ]);
    await expect(service.unreadTotal(OWNER)).resolves.toEqual({ unreadCount: 5 });
    expect(dataSource.query.mock.calls[0][0]).toContain('owner_last_read_at');
  });

  it('lịch sử tin nhắn trả về theo thứ tự cũ -> mới và giới hạn số lượng', async () => {
    const { service, messageQuery } = setup();
    messageQuery.getMany.mockResolvedValueOnce([
      { id: 'm2', createdAt: new Date('2026-10-16T09:00:00Z'), call: null },
      { id: 'm1', createdAt: new Date('2026-10-16T08:00:00Z'), call: null },
    ]);
    const list = await service.listMessages(OWNER, 'conv-1', { limit: 500 });

    expect(list.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(messageQuery.take).toHaveBeenCalledWith(100);
  });
});
