import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@/shared/common/enums/role.enum';
import { CallMedia, CallStatus } from '@/shared/common/enums/messaging.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { CALL_RING_TIMEOUT_MS, CallsService } from './calls.service';

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

function setup() {
  const sessions = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const calls = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => {
      const saved = { id: `call-${++seq}`, answeredAt: null, ...value };
      sessions.set(saved.id, saved);
      return saved;
    }),
    update: jest.fn(async (id: string, patch: Record<string, unknown>) => {
      Object.assign(sessions.get(id) ?? {}, patch);
    }),
    findOne: jest.fn(
      async ({ where }: { where: { id: string } }) => sessions.get(where.id) ?? null,
    ),
  };
  const users = {
    findOne: jest.fn().mockResolvedValue({ fullName: 'Nguyễn Minh Anh', avatarUrl: null }),
  };
  const messaging = {
    // conv-1: OWNER <-> DOCTOR; conv-2: OTHER_OWNER <-> DOCTOR.
    loadMembershipForActor: jest.fn(async (actor: AuthenticatedUser, conversationId: string) => {
      const ownerUserId = { 'conv-1': OWNER.userId, 'conv-2': OTHER_OWNER.userId }[conversationId];
      if (!ownerUserId || ![ownerUserId, DOCTOR.userId].includes(actor.userId)) {
        throw new NotFoundException();
      }
      return {
        me:
          actor.role === Role.DOCTOR
            ? { side: 'DOCTOR', userId: actor.userId, doctorId: 'doctor-1' }
            : { side: 'OWNER', userId: actor.userId },
        ownerUserId,
        doctorUserId: DOCTOR.userId,
        conversation: { id: conversationId },
      };
    }),
    recordCallLog: jest.fn().mockResolvedValue(undefined),
  };
  const events = {
    emitToUsers: jest.fn(),
    emitToSocket: jest.fn(),
    isUserOnline: jest.fn().mockReturnValue(true),
  };
  const config = { get: jest.fn().mockReturnValue([{ urls: ['stun:stun.l.google.com:19302'] }]) };
  const push = {
    sendToUser: jest.fn().mockResolvedValue(undefined),
    hasDevices: jest.fn().mockResolvedValue(false),
  };

  const service = new CallsService(
    calls as never,
    users as never,
    messaging as never,
    events,
    config as never,
    push,
  );
  return { service, calls, messaging, events, sessions, push };
}

function emitted(events: { emitToUsers: jest.Mock }, name: string) {
  return events.emitToUsers.mock.calls.filter(([, event]) => event === name);
}

describe('CallsService', () => {
  afterEach(() => jest.useRealTimers());

  it('luồng đầy đủ: đổ chuông -> nhận -> chuyển tín hiệu -> kết thúc, có ghi lịch sử', async () => {
    const { service, events, messaging, sessions } = setup();

    const invite = await service.invite(OWNER, 'sock-owner', {
      conversationId: 'conv-1',
      media: CallMedia.VIDEO,
    });
    expect(invite.status).toBe(CallStatus.RINGING);
    expect(emitted(events, 'call:incoming')[0][0]).toEqual(['doctor-user']);

    await service.accept('doctor-user', 'sock-doctor', invite.callId);
    expect(emitted(events, 'call:accepted')).toHaveLength(1);
    expect(sessions.get(invite.callId)?.status).toBe(CallStatus.ACCEPTED);

    service.relaySignal('owner-user', 'sock-owner', invite.callId, { type: 'offer', sdp: 'x' });
    expect(events.emitToSocket).toHaveBeenCalledWith('sock-doctor', 'call:signal', {
      callId: invite.callId,
      data: { type: 'offer', sdp: 'x' },
    });
    service.relaySignal('doctor-user', 'sock-doctor', invite.callId, { type: 'answer' });
    expect(events.emitToSocket).toHaveBeenLastCalledWith(
      'sock-owner',
      'call:signal',
      expect.anything(),
    );

    await service.hangUp('doctor-user', invite.callId);
    expect(sessions.get(invite.callId)).toMatchObject({
      status: CallStatus.ENDED,
      endReason: 'HANGUP',
    });
    expect(emitted(events, 'call:ended')[0][2]).toMatchObject({ status: CallStatus.ENDED });
    expect(messaging.recordCallLog).toHaveBeenCalledWith(
      expect.objectContaining({ id: invite.callId }),
      expect.stringContaining('Cuộc gọi video ·'),
    );
    expect(service.findActiveCallOf('owner-user')).toBeUndefined();
  });

  it('người ngoài cuộc trò chuyện không gọi được', async () => {
    const { service, calls } = setup();
    await expect(
      service.invite({ ...OWNER, userId: 'stranger' }, 'sock-x', {
        conversationId: 'conv-1',
        media: CallMedia.AUDIO,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(calls.save).not.toHaveBeenCalled();
  });

  it('chỉ người được gọi mới nhận máy; tab khác không chen được vào kênh tín hiệu', async () => {
    const { service } = setup();
    const { callId } = await service.invite(OWNER, 'sock-owner', {
      conversationId: 'conv-1',
      media: CallMedia.AUDIO,
    });

    await expect(service.accept('owner-user', 'sock-owner', callId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(() => service.relaySignal('owner-user', 'sock-owner', callId, {})).toThrow(
      ConflictException,
    );

    await service.accept('doctor-user', 'sock-doctor-tab1', callId);
    await expect(service.accept('doctor-user', 'sock-doctor-tab2', callId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(() => service.relaySignal('doctor-user', 'sock-doctor-tab2', callId, {})).toThrow(
      ForbiddenException,
    );
  });

  it('từ chối cuộc gọi -> REJECTED và báo cho cả hai', async () => {
    const { service, events, sessions } = setup();
    const { callId } = await service.invite(DOCTOR, 'sock-doctor', {
      conversationId: 'conv-1',
      media: CallMedia.AUDIO,
    });
    await service.reject('owner-user', callId);

    expect(sessions.get(callId)).toMatchObject({
      status: CallStatus.REJECTED,
      endReason: 'REJECTED',
    });
    expect(emitted(events, 'call:ended')[0][0]).toEqual(['doctor-user', 'owner-user']);
  });

  it('người gọi huỷ khi đang đổ chuông -> CANCELLED', async () => {
    const { service, sessions } = setup();
    const { callId } = await service.invite(OWNER, 'sock-owner', {
      conversationId: 'conv-1',
      media: CallMedia.AUDIO,
    });
    await service.hangUp('owner-user', callId);
    expect(sessions.get(callId)?.status).toBe(CallStatus.CANCELLED);
  });

  it('không ai nhấc máy sau thời gian chờ -> MISSED', async () => {
    jest.useFakeTimers();
    const { service, sessions, messaging } = setup();
    const { callId } = await service.invite(OWNER, 'sock-owner', {
      conversationId: 'conv-1',
      media: CallMedia.AUDIO,
    });

    await jest.advanceTimersByTimeAsync(CALL_RING_TIMEOUT_MS + 10);
    expect(sessions.get(callId)).toMatchObject({
      status: CallStatus.MISSED,
      endReason: 'NO_ANSWER',
    });
    expect(messaging.recordCallLog).toHaveBeenCalledWith(expect.anything(), 'Cuộc gọi thoại nhỡ');
  });

  it('người nhận không trực tuyến -> nhỡ ngay, không đổ chuông', async () => {
    const { service, events } = setup();
    events.isUserOnline.mockReturnValue(false);
    const result = await service.invite(OWNER, 'sock-owner', {
      conversationId: 'conv-1',
      media: CallMedia.AUDIO,
    });
    expect(result).toMatchObject({ status: CallStatus.MISSED, reason: 'OFFLINE' });
    expect(emitted(events, 'call:incoming')).toHaveLength(0);
    expect(service.findActiveCallOf('owner-user')).toBeUndefined();
  });

  it('người nhận đóng app nhưng có máy nhận push -> đổ chuông qua push, gửi lại khi nối socket', async () => {
    const { service, events, push } = setup();
    events.isUserOnline.mockReturnValue(false);
    push.hasDevices.mockResolvedValue(true);
    const result = await service.invite(DOCTOR, 'sock-doctor', {
      conversationId: 'conv-1',
      media: CallMedia.VIDEO,
    });
    expect(result).toMatchObject({ status: CallStatus.RINGING });
    expect(push.sendToUser).toHaveBeenCalledWith(
      OWNER.userId,
      expect.objectContaining({
        channelId: 'calls',
        data: { kind: 'call', callId: result.callId },
      }),
    );
    expect(service.pendingInvitationFor(OWNER.userId)).toMatchObject({
      callId: result.callId,
      media: CallMedia.VIDEO,
    });

    await service.accept(OWNER.userId, 'sock-owner', result.callId);
    expect(service.pendingInvitationFor(OWNER.userId)).toBeUndefined();
  });

  it('không gọi chồng: người gọi đang có cuộc gọi khác thì bị chặn', async () => {
    const { service } = setup();
    await service.invite(OWNER, 'sock-owner', { conversationId: 'conv-1', media: CallMedia.AUDIO });
    await expect(
      service.invite(OWNER, 'sock-owner-2', { conversationId: 'conv-1', media: CallMedia.AUDIO }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('người nhận đang bận với cuộc gọi khác -> REJECTED lý do BUSY, không đổ chuông', async () => {
    const { service, events, sessions } = setup();
    const first = await service.invite(OWNER, 'sock-owner', {
      conversationId: 'conv-1',
      media: CallMedia.AUDIO,
    });
    await service.accept('doctor-user', 'sock-doctor', first.callId);
    events.emitToUsers.mockClear();

    const second = await service.invite(OTHER_OWNER, 'sock-other', {
      conversationId: 'conv-2',
      media: CallMedia.AUDIO,
    });
    expect(second).toMatchObject({ status: CallStatus.REJECTED, reason: 'BUSY' });
    expect(sessions.get(second.callId)?.status).toBe(CallStatus.REJECTED);
    expect(emitted(events, 'call:incoming')).toHaveLength(0);
    // Cuộc gọi đang diễn ra không bị ảnh hưởng.
    expect(service.findActiveCallOf('doctor-user')?.id).toBe(first.callId);
  });

  it('tab giữ cuộc gọi bị ngắt kết nối -> kết thúc cuộc gọi', async () => {
    const { service, sessions } = setup();
    const { callId } = await service.invite(OWNER, 'sock-owner', {
      conversationId: 'conv-1',
      media: CallMedia.VIDEO,
    });
    await service.accept('doctor-user', 'sock-doctor', callId);
    await service.handleDisconnect('sock-doctor');

    expect(sessions.get(callId)).toMatchObject({
      status: CallStatus.ENDED,
      endReason: 'DISCONNECTED',
    });
  });
});
