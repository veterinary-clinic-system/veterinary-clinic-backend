import { ConflictException } from '@nestjs/common';
import { AiChatAgentService, AssistantChatResponse } from './ai-chat-agent.service';
import { SlotStatus } from '@/modules/scheduling/application';
import { Gender } from '@/shared/common/enums/gender.enum';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { SendChatMessageDto } from '@/modules/assistant/presentation/dto/send-chat-message.dto';

// Thứ 5, 15/10/2026 10:00 - "mai" là thứ 6 16/10.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

const branches = [
  { id: 'b-q1', branchName: 'Phòng khám thú y Quận 1', address: '12 Nguyễn Huệ', active: true },
  {
    id: 'b-q7',
    branchName: 'Phòng khám thú y Quận 7',
    address: '456 Nguyễn Thị Thập',
    active: true,
  },
];
const services = [
  { id: 's-tiem', durationMinutes: 30, active: true, item: { itemName: 'Tiêm phòng dại' } },
  { id: 's-kham', durationMinutes: 30, active: true, item: { itemName: 'Khám tổng quát' } },
];
const species = [
  { id: 'sp-dog', speciesName: 'Chó' },
  { id: 'sp-cat', speciesName: 'Mèo' },
];
const breeds = [
  { id: 'br-poodle', breedName: 'Poodle', speciesId: 'sp-dog' },
  { id: 'br-dog-other', breedName: 'Giống khác / chưa xác định', speciesId: 'sp-dog' },
  { id: 'br-cat-ta', breedName: 'Mèo ta (mèo cỏ)', speciesId: 'sp-cat' },
  { id: 'br-cat-other', breedName: 'Giống khác / chưa xác định', speciesId: 'sp-cat' },
];

function daySlots(date: Date, busy: string[] = []) {
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const starts = weekend
    ? []
    : [
        '07:00',
        '07:30',
        '08:00',
        '08:30',
        '09:00',
        '09:30',
        '10:00',
        '10:30',
        '13:30',
        '14:00',
        '14:30',
        '15:00',
      ];
  return {
    date: ymd,
    dayOfWeek: date.getDay(),
    isBranchOpen: !weekend,
    slots: starts.map((start) => {
      const startAt = new Date(`${ymd}T${start}:00`);
      const endAt = new Date(startAt.getTime() + 30 * 60_000);
      return {
        start,
        end: `${String(endAt.getHours()).padStart(2, '0')}:${String(endAt.getMinutes()).padStart(2, '0')}`,
        startAt,
        endAt,
        status: busy.includes(`${ymd} ${start}`) ? SlotStatus.BOOKED : SlotStatus.FREE,
      };
    }),
  };
}

describe('AiChatAgentService', () => {
  let busy: string[];
  let service: AiChatAgentService;
  const aiProvider = {
    triage: jest.fn(),
    chat: jest.fn(),
    answerPetCareQuestion: jest.fn(),
    learn: jest.fn(),
  };
  const appointmentsService = { createBookingWithReport: jest.fn() };
  const availabilityService = {
    getDoctorDayAvailability: jest.fn((_doctorId: string, _branchId: string, date: Date) =>
      Promise.resolve(daySlots(date, busy)),
    ),
  };
  const dataSource = { query: jest.fn() };
  const usersRepository = { findOne: jest.fn() };
  const petsRepository = { find: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    busy = [];
    usersRepository.findOne.mockResolvedValue(null);
    petsRepository.find.mockResolvedValue([]);
    appointmentsService.createBookingWithReport.mockImplementation((dto) =>
      Promise.resolve({
        appointment: {
          id: 'abcdef12-0000-0000-0000-000000000000',
          startAt: new Date(dto.startAt),
          status: 'PENDING',
          pet: { name: dto.newPet?.name ?? 'Milu' },
        },
        notifications: {
          simulated: false,
          deliveries: [
            { channel: 'ZALO', recipient: dto.phone, status: 'SENT', error: null },
            ...(dto.email
              ? [{ channel: 'EMAIL', recipient: dto.email, status: 'SENT', error: null }]
              : []),
          ],
        },
      }),
    );

    service = new AiChatAgentService(
      aiProvider as never,
      appointmentsService as never,
      availabilityService as never,
      dataSource as never,
      { find: jest.fn().mockResolvedValue(branches) } as never,
      { find: jest.fn().mockResolvedValue(services) } as never,
      { find: jest.fn().mockResolvedValue(species) } as never,
      { find: jest.fn().mockResolvedValue(breeds) } as never,
      usersRepository as never,
      petsRepository as never,
      {
        find: jest.fn().mockResolvedValue([{ id: 'doctor-1' }]),
        findOne: jest.fn().mockResolvedValue({ id: 'doctor-1' }),
      } as never,
    );
  });

  async function say(
    message: string,
    previous?: AssistantChatResponse,
    actor: AuthenticatedUser | null = null,
    extra: Partial<SendChatMessageDto> = {},
  ) {
    return service.processChat(
      { message, draft: previous?.draft, sessionId: previous?.sessionId, ...extra },
      actor,
      NOW,
    );
  }

  it('khách vãng lai: hỏi đủ thông tin rồi tự đặt lịch, báo đúng kênh đã gửi', async () => {
    const first = await say('Tôi muốn đặt lịch khám cho bé');
    expect(first.intent).toBe('BOOKING');
    expect(first.missingFields).toEqual(
      expect.arrayContaining([
        'petName',
        'species',
        'gender',
        'branch',
        'date',
        'time',
        'phone',
        'ownerName',
      ]),
    );
    expect(appointmentsService.createBookingWithReport).not.toHaveBeenCalled();

    const second = await say('Bé tên Milu, mèo cái, ở quận 7, sáng mai 9h', first);
    expect(second.missingFields).toEqual(['phone', 'ownerName']);
    expect(second.reply).toContain('Milu');

    const done = await say('Nguyễn Văn An, 0912345678, an.nguyen@gmail.com', second);
    expect(appointmentsService.createBookingWithReport).toHaveBeenCalledTimes(1);
    const [dto, bookedBy] = appointmentsService.createBookingWithReport.mock.calls[0];
    expect(bookedBy).toBeNull();
    expect(dto).toMatchObject({
      phone: '0912345678',
      ownerFullName: 'Nguyễn Văn An',
      email: 'an.nguyen@gmail.com',
      branchId: 'b-q7',
      serviceId: 's-kham',
      newPet: { name: 'Milu', speciesId: 'sp-cat', breedId: 'br-cat-other', gender: Gender.FEMALE },
    });
    expect(new Date(dto.startAt)).toEqual(new Date(2026, 9, 16, 9, 0));
    expect(done.booking?.code).toBe('ABCDEF12');
    expect(done.reply).toContain('Zalo (0912345678)');
    expect(done.reply).toContain('Gmail (an.nguyen@gmail.com)');
    // Đặt xong: bỏ thông tin lịch hẹn, giữ liên hệ cho lần sau.
    expect(done.draft).toEqual({
      phone: '0912345678',
      ownerFullName: 'Nguyễn Văn An',
      email: 'an.nguyen@gmail.com',
    });
  });

  it('giờ đã kín: đề xuất giờ trống gần nhất, khách chọn số thứ tự thì đặt đúng giờ đó', async () => {
    busy = ['2026-10-16 09:00'];
    const offered = await say(
      'đặt lịch cho bé Milu mèo đực ở Quận 1 lúc 9h ngày mai, tôi tên Lan sđt 0912345678',
    );
    expect(appointmentsService.createBookingWithReport).not.toHaveBeenCalled();
    expect(offered.missingFields).toEqual(['slotChoice']);
    expect(offered.quickReplies).toEqual([
      '08:00 Thứ 6 16/10/2026',
      '08:30 Thứ 6 16/10/2026',
      '09:30 Thứ 6 16/10/2026',
    ]);

    await say('3', offered);
    const [dto] = appointmentsService.createBookingWithReport.mock.calls[0];
    expect(new Date(dto.startAt)).toEqual(new Date(2026, 9, 16, 9, 30));
  });

  it('chọn ngày chi nhánh nghỉ: báo ngay và gợi ý ngày mở cửa thật (không phải "Sáng mai")', async () => {
    const reply = await say('đặt lịch bé Milu mèo đực quận 1 thứ 7 lúc 9h');
    expect(appointmentsService.createBookingWithReport).not.toHaveBeenCalled();
    expect(reply.reply).toContain('không làm việc vào **Thứ 7 17/10/2026**');
    expect(reply.missingFields).toEqual(['date', 'phone', 'ownerName']);
    expect(reply.draft.time).toBe('09:00');
    expect(reply.quickReplies).toEqual([
      'Sáng Thứ 6 16/10',
      'Chiều Thứ 6 16/10',
      'Sáng Thứ 2 19/10',
    ]);

    // Bấm gợi ý -> đặt đúng ngày đó (giữ giờ 9h đã nói).
    const done = await say('Sáng Thứ 2 19/10, tôi tên Lan 0912345678', reply);
    expect(new Date(done.booking!.startAt)).toEqual(new Date(2026, 9, 19, 9, 0));
  });

  it('kín lịch cả ngày: đề xuất ngày sau, giờ gần giờ khách muốn nhất', async () => {
    busy = [
      '07:00',
      '07:30',
      '08:00',
      '08:30',
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '13:30',
      '14:00',
      '14:30',
      '15:00',
    ].map((t) => `2026-10-16 ${t}`);
    const offered = await say('đặt lịch bé Milu mèo đực quận 1 mai 9h, tôi tên Lan 0912345678');
    expect(offered.reply).toContain('đã kín lịch cả ngày');
    expect(offered.quickReplies).toEqual([
      '08:30 Thứ 2 19/10/2026',
      '09:00 Thứ 2 19/10/2026',
      '09:30 Thứ 2 19/10/2026',
    ]);
  });

  it('không nhận lịch trong hôm nay, và hướng dẫn tới ngay nếu bé đang nguy cấp', async () => {
    const reply = await say(
      'đặt lịch hôm nay 15h cho bé Milu mèo đực ở quận 1, tôi tên Lan 0912345678',
      undefined,
      null,
      {
        draft: { priorityColor: PriorityColor.RED },
      },
    );
    expect(appointmentsService.createBookingWithReport).not.toHaveBeenCalled();
    expect(reply.missingFields).toEqual(['date']);
    expect(reply.reply).toContain('từ ngày mai');
    expect(reply.reply).toContain('đưa bé tới phòng khám ngay');
  });

  it('chủ nuôi đã đăng nhập: không hỏi SĐT, dùng bé có sẵn, chọn giờ trống đầu buổi chiều', async () => {
    const owner = {
      id: 'u-owner',
      fullName: 'Chị Hoa',
      phone: '0911111111',
      email: 'hoa@gmail.com',
      active: true,
    };
    usersRepository.findOne.mockResolvedValue(owner);
    petsRepository.find.mockResolvedValue([
      {
        id: 'pet-1',
        name: 'Mực',
        breedId: 'br-poodle',
        gender: Gender.MALE,
        breed: { speciesId: 'sp-dog' },
      },
    ]);
    const actor = { userId: 'u-owner', phone: owner.phone, role: Role.PET_OWNER, branchId: null };

    const reply = await say('đặt lịch chiều mai ở chi nhánh quận 1', undefined, actor);
    const [dto] = appointmentsService.createBookingWithReport.mock.calls[0];
    expect(dto).toMatchObject({
      phone: '0911111111',
      ownerFullName: 'Chị Hoa',
      email: 'hoa@gmail.com',
      petId: 'pet-1',
    });
    expect(new Date(dto.startAt)).toEqual(new Date(2026, 9, 16, 13, 30));
    expect(reply.reply).toContain('bé duy nhất');
  });

  it('chủ nuôi gửi petId của người khác trong draft: bị bỏ, không đặt cho bé đó', async () => {
    usersRepository.findOne.mockResolvedValue({
      id: 'u-owner',
      fullName: 'Hoa',
      phone: '0911111111',
      email: null,
    });
    petsRepository.find.mockResolvedValue([
      {
        id: 'pet-1',
        name: 'Mực',
        breedId: 'br-poodle',
        gender: Gender.MALE,
        breed: { speciesId: 'sp-dog' },
      },
      {
        id: 'pet-2',
        name: 'Vàng',
        breedId: 'br-poodle',
        gender: Gender.FEMALE,
        breed: { speciesId: 'sp-dog' },
      },
    ]);
    const actor = { userId: 'u-owner', phone: '0911111111', role: Role.PET_OWNER, branchId: null };
    const reply = await say('đặt lịch sáng mai quận 1', undefined, actor, {
      draft: { petId: '11111111-1111-1111-1111-111111111111' },
    });
    expect(reply.draft.petId).toBeUndefined();
    expect(reply.missingFields).toEqual(['petChoice']);
    expect(reply.quickReplies).toEqual(['Mực', 'Vàng']);
  });

  it('khách vãng lai hỏi lịch tiêm: yêu cầu đăng nhập, KHÔNG tra theo SĐT', async () => {
    const reply = await say('kiểm tra lịch tiêm của bé, sđt 0911111111');
    expect(reply.intent).toBe('SCHEDULE_LOOKUP');
    expect(reply.requiresLogin).toBe(true);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('chủ nuôi hỏi lịch tiêm/tái khám: trả về lịch của chính họ', async () => {
    usersRepository.findOne.mockResolvedValue({
      id: 'u-owner',
      fullName: 'Hoa',
      phone: '0911111111',
    });
    dataSource.query
      .mockResolvedValueOnce([
        { petName: 'Mực', vaccineName: 'Vắc-xin dại', nextDueDate: '2026-10-10' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'a1',
          petName: 'Mực',
          branchName: 'Quận 1',
          serviceName: 'Khám tổng quát',
          startAt: new Date(2026, 9, 20, 9, 0),
          status: 'PENDING',
          isFollowUp: true,
        },
      ]);
    const actor = { userId: 'u-owner', phone: '0911111111', role: Role.PET_OWNER, branchId: null };
    const reply = await say('Kiểm tra lịch tái khám cho bé', undefined, actor);
    expect(dataSource.query.mock.calls[0][1][0]).toBe('u-owner');
    expect(reply.schedule?.vaccinations[0].overdue).toBe(true);
    expect(reply.reply).toContain('ĐÃ QUÁ HẠN');
    expect(reply.reply).toContain('[Tái khám]');
    expect(reply.quickReplies).toEqual(['Đặt lịch tiêm phòng']);
  });

  it('mô tả triệu chứng kèm ảnh: gọi AI với ảnh + loài, rồi "ok" thì vào luồng đặt lịch', async () => {
    aiProvider.triage.mockResolvedValue({
      priorityColor: PriorityColor.YELLOW,
      suspectedGroups: [{ name: 'Viêm dạ dày ruột', confidence: 0.62 }],
      extractedKeywords: [],
      nlpConfidence: 0.6,
      cvConfidence: null,
      overallConfidence: 0.6,
      raw: { triage_result: { reasoning: 'Nôn nhiều lần kèm bỏ ăn.' } },
      modelVersion: 'test',
    });

    const triage = await say('Bé cún nhà em bị nôn mửa và bỏ ăn 2 ngày nay', undefined, null, {
      images: ['https://res.cloudinary.com/demo/image/upload/a.jpg'],
    });
    expect(aiProvider.triage).toHaveBeenCalledWith(
      expect.objectContaining({
        petSpecies: 'Chó',
        photoUrls: ['https://res.cloudinary.com/demo/image/upload/a.jpg'],
      }),
    );
    expect(triage.intent).toBe('TRIAGE');
    expect(triage.triage?.priorityColor).toBe(PriorityColor.YELLOW);
    expect(triage.reply).toContain('Nôn nhiều lần kèm bỏ ăn.');
    expect(triage.reply).toContain('1 ảnh');

    const consent = await say('ok', triage);
    expect(consent.intent).toBe('BOOKING');
    // Loài đã biết từ câu mô tả triệu chứng nên không hỏi lại.
    expect(consent.missingFields).not.toContain('species');
    expect(consent.draft.photoUrls).toHaveLength(1);
  });

  it('AI sàng lọc lỗi: trả lời thật thà, không bịa mức độ', async () => {
    aiProvider.triage.mockRejectedValue(new Error('ECONNREFUSED'));
    const reply = await say('mèo nhà em bị co giật');
    expect(reply.triage).toBeUndefined();
    expect(reply.reply).toContain('tạm gián đoạn');
  });

  it('lỗi nghiệp vụ khi lưu lịch (vừa có người đặt): hỏi lại giờ, không báo thành công', async () => {
    appointmentsService.createBookingWithReport.mockRejectedValue(
      new ConflictException('Không còn bác sĩ nào trống vào khung giờ này'),
    );
    const reply = await say('đặt lịch bé Milu mèo đực quận 1 mai 9h, tôi tên Lan 0912345678');
    expect(reply.booking).toBeUndefined();
    expect(reply.reply).toContain('chưa đặt được');
    expect(reply.missingFields).toEqual(['time']);
  });

  it('nói "hôm nay" khi còn thiếu thông tin: báo ngay, không đợi khai đủ', async () => {
    const reply = await say('đặt lịch hôm nay 15h cho bé Mon ở quận 1');
    expect(reply.reply).toContain('từ ngày mai');
    expect(reply.missingFields).toContain('date');
    expect(reply.draft.time).toBe('15:00');
  });

  it('đặt tên cho bé đã được mô tả trước đó: giữ loài đã biết', async () => {
    aiProvider.triage.mockRejectedValue(new Error('down'));
    const triage = await say('Bé cún nhà em bị nôn');
    const named = await say('đặt lịch cho bé tên Mon', triage);
    expect(named.missingFields).not.toContain('species');
    const renamed = await say('à nhầm, đặt cho bé tên Na', named);
    expect(renamed.missingFields).toContain('species');
  });

  it('câu hỏi chăm sóc chung: LLM trả lời thì dùng câu trả lời đó', async () => {
    aiProvider.answerPetCareQuestion.mockResolvedValue({
      answer: 'Dạ mèo nên được tắm khoảng 1-2 tháng một lần ạ.',
      suggestVisit: false,
    });
    const reply = await say('mèo nên tắm bao lâu một lần');
    expect(aiProvider.answerPetCareQuestion).toHaveBeenCalledWith({
      question: 'mèo nên tắm bao lâu một lần',
    });
    expect(reply.intent).toBe('HELP');
    expect(reply.reply).toBe('Dạ mèo nên được tắm khoảng 1-2 tháng một lần ạ.');
    expect(reply.suggestBooking).toBe(false);
  });

  it('LLM khuyên đi khám: gợi ý đặt lịch', async () => {
    aiProvider.answerPetCareQuestion.mockResolvedValue({
      answer: 'Dạ bạn nên đưa bé đi khám sớm ạ.',
      suggestVisit: true,
    });
    const reply = await say('tại sao chó nhà em thở rất gấp');
    expect(reply.suggestBooking).toBe(true);
    expect(reply.quickReplies).toContain('Đặt lịch khám');
  });

  it('LLM lỗi hoặc hết hạn key: giữ câu trả lời cố định của nhánh HELP', async () => {
    aiProvider.answerPetCareQuestion.mockRejectedValue(new Error('401'));
    const reply = await say('mèo nên tắm bao lâu một lần');
    expect(reply.intent).toBe('HELP');
    expect(reply.reply).toContain('em chưa hiểu rõ ý bạn');
    expect(reply.suggestBooking).toBe(false);
  });

  it('huỷ giữa chừng: xoá thông tin đặt lịch', async () => {
    const first = await say('đặt lịch cho bé Milu ở quận 1');
    const reset = await say('thôi không đặt nữa', first);
    expect(reset.intent).toBe('RESET');
    expect(reset.draft.branchId).toBeUndefined();
    expect(reset.draft.active).toBeUndefined();
  });
});
