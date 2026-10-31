import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { addMinutes, differenceInMonths, format } from 'date-fns';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Breed } from '@/modules/pets/domain/entities/breed.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Species } from '@/modules/pets/domain/entities/species.entity';
import {
  AppointmentsService,
  AvailabilityService,
  CreateBookingDto,
  SlotStatus,
  earliestSelfBookableStart,
  slotsCovering,
} from '@/modules/scheduling/application';
import type { DeliveryReport } from '@/modules/notification/application';
import {
  AI_PREDICTION_PROVIDER,
  AiPetCareAnswer,
  AiPredictionProvider,
  AiTriageResult,
  KEYWORD_TRIAGE_MODEL_VERSION,
} from '@/modules/triage/application';
import { Gender } from '@/shared/common/enums/gender.enum';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import {
  NamedOption,
  detectGender,
  detectIntents,
  detectSpeciesPrefix,
  extractEmail,
  extractOwnerName,
  extractPetName,
  extractPhone,
  matchOption,
  nameAliases,
  normalizeText,
  parseChoiceIndex,
  hasInvalidDateText,
  parseDate,
  parseTime,
  stripDiacritics,
} from '@/modules/assistant/domain/chat-language';
import {
  BookingDraftDto,
  MAX_CHAT_IMAGES,
  MAX_CHAT_VIDEOS,
  SendChatMessageDto,
} from '@/modules/assistant/presentation/dto/send-chat-message.dto';

export type BookingDraft = BookingDraftDto;

export type ChatIntent =
  | 'GREETING'
  | 'THANKS'
  | 'TRIAGE'
  | 'BOOKING'
  | 'SCHEDULE_LOOKUP'
  | 'VACCINE_INFO'
  | 'RESET'
  | 'HELP';

export interface ChatTriage {
  priorityColor: PriorityColor;
  reasoning: string | null;
  suspectedDiseases: Array<{ name: string; confidence: number }>;
  analyzedImages: number;
  analyzedVideos: number;
}

export interface ChatBooking {
  id: string;
  code: string;
  petName: string;
  branchName: string;
  branchAddress: string;
  serviceName: string;
  /** Bác sĩ hệ thống tự phân công - khách đặt qua chat không chọn bác sĩ. */
  doctorName: string | null;
  startAt: string;
  status: string;
}

export interface ChatSchedule {
  vaccinations: Array<{
    petName: string;
    vaccineName: string;
    nextDueDate: string;
    overdue: boolean;
  }>;
  appointments: Array<{
    id: string;
    petName: string;
    branchName: string;
    serviceName: string | null;
    startAt: string;
    status: string;
    isFollowUp: boolean;
  }>;
}

export interface AssistantChatResponse {
  sessionId: string;
  reply: string;
  intent: ChatIntent;
  draft: BookingDraft;
  missingFields: string[];
  quickReplies: string[];
  suggestBooking: boolean;
  /** Việc khách hỏi cần đăng nhập (xem lịch tiêm/tái khám của chính bé). */
  requiresLogin: boolean;
  triage?: ChatTriage;
  booking?: ChatBooking;
  notifications?: DeliveryReport | null;
  schedule?: ChatSchedule;
}

interface ChatContext {
  branches: Branch[];
  services: Service[];
  species: Species[];
  breeds: Breed[];
  /** Chỉ có khi người gọi là CHỦ NUÔI đã đăng nhập - nhân viên dùng chat như khách. */
  owner: User | null;
  pets: Pet[];
}

interface BookingOutcome {
  reply: string;
  missingFields: string[];
  quickReplies: string[];
  booking?: ChatBooking;
  notifications?: DeliveryReport | null;
}

const PRIORITY_TEXT: Record<PriorityColor, string> = {
  [PriorityColor.RED]: 'CẤP CỨU - cần can thiệp y tế ngay',
  [PriorityColor.ORANGE]: 'KHẨN CẤP - nên tới phòng khám trong 1-2 giờ',
  [PriorityColor.YELLOW]: 'NÊN KHÁM TRONG NGÀY',
  [PriorityColor.GREEN]: 'ÍT KHẨN CẤP - có thể đặt lịch khám',
  [PriorityColor.BLUE]: 'THEO DÕI TẠI NHÀ - triệu chứng nhẹ',
};

const PRIORITY_ADVICE: Record<PriorityColor, string> = {
  [PriorityColor.RED]:
    'Bạn hãy đưa bé tới phòng khám NGAY hoặc gọi hotline - đừng chờ lịch hẹn. Giữ bé nằm yên, ' +
    'thoáng khí; không tự cho uống thuốc của người.',
  [PriorityColor.ORANGE]:
    'Bé nên được bác sĩ khám sớm trong hôm nay. Lịch hẹn trực tuyến chỉ nhận từ ngày mai, nên nếu ' +
    'tình trạng không cải thiện, bạn hãy đưa bé tới thẳng phòng khám.',
  [PriorityColor.YELLOW]:
    'Bạn nên cho bé đi khám sớm. Trong lúc chờ: cho bé nghỉ nơi yên tĩnh, uống nước sạch từng ' +
    'chút một, theo dõi ăn uống và đi vệ sinh.',
  [PriorityColor.GREEN]:
    'Tình trạng hiện chưa đáng lo, nhưng bạn nên đặt lịch để bác sĩ kiểm tra. Theo dõi thêm ăn ' +
    'uống, đi vệ sinh và tinh thần của bé.',
  [PriorityColor.BLUE]:
    'Bạn có thể theo dõi tại nhà: giữ vệ sinh, cho ăn uống bình thường. Nếu triệu chứng kéo dài ' +
    'quá 2-3 ngày hoặc nặng hơn, hãy đặt lịch khám.',
};

const FIELD_QUESTIONS: Record<string, string> = {
  petChoice: 'Bạn muốn đặt lịch cho bé nào?',
  petName: 'Bé tên là gì ạ?',
  species: 'Bé là **chó, mèo** hay loài nào khác?',
  gender: 'Bé là **đực** hay **cái**?',
  branch: 'Bạn muốn khám ở **chi nhánh** nào?',
  date: 'Bạn muốn đưa bé tới **ngày nào**?',
  time: 'Khoảng **mấy giờ** hoặc buổi nào (sáng/chiều)?',
  phone: 'Cho em xin **số điện thoại** để phòng khám liên hệ và gửi xác nhận qua **Zalo**',
  ownerName: 'Cho em xin **họ tên** của bạn',
};

const SEARCH_DAYS_AHEAD = 7;
const MAX_ALTERNATIVES = 3;
const NOON = '12:00';

@Injectable()
export class AiChatAgentService {
  private readonly logger = new Logger(AiChatAgentService.name);

  constructor(
    @Inject(AI_PREDICTION_PROVIDER)
    private readonly aiProvider: AiPredictionProvider,
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(Service) private readonly servicesRepository: Repository<Service>,
    @InjectRepository(Species) private readonly speciesRepository: Repository<Species>,
    @InjectRepository(Breed) private readonly breedsRepository: Repository<Breed>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Pet) private readonly petsRepository: Repository<Pet>,
    @InjectRepository(Doctor) private readonly doctorsRepository: Repository<Doctor>,
  ) {}

  async processChat(
    dto: SendChatMessageDto,
    actor: AuthenticatedUser | null,
    now: Date = new Date(),
  ): Promise<AssistantChatResponse> {
    const sessionId = dto.sessionId ?? randomUUID();
    const ctx = await this.loadContext(actor);
    const draft = this.sanitizeDraft(dto.draft ?? {}, ctx);
    const awaiting = new Set(draft.awaiting ?? []);
    draft.awaiting = undefined;

    const message = dto.message.trim();
    const images = (dto.images ?? []).slice(0, MAX_CHAT_IMAGES);
    const videos = (dto.videos ?? []).slice(0, MAX_CHAT_VIDEOS);
    const intents = detectIntents(message);

    const respond = (
      partial: Partial<AssistantChatResponse> & Pick<AssistantChatResponse, 'reply' | 'intent'>,
    ): AssistantChatResponse => ({
      sessionId,
      draft,
      missingFields: [],
      quickReplies: [],
      suggestBooking: false,
      requiresLogin: false,
      ...partial,
    });

    if (intents.reset) {
      this.clearBooking(draft);
      return respond({
        intent: 'RESET',
        reply: 'Dạ em đã huỷ yêu cầu đặt lịch đang dở. Bạn cần em hỗ trợ gì thêm cho bé không ạ?',
        quickReplies: ['Đặt lịch khám', 'Lịch tiêm phòng của bé'],
      });
    }

    if (images.length > 0) {
      draft.photoUrls = [...(draft.photoUrls ?? []), ...images].slice(-MAX_CHAT_IMAGES);
    }
    if (videos.length > 0) {
      draft.videoUrls = [...(draft.videoUrls ?? []), ...videos].slice(-MAX_CHAT_VIDEOS);
    }

    this.mergePetFacts(message, draft, ctx, awaiting);

    if (intents.scheduleLookup) {
      return respond(await this.handleScheduleLookup(ctx, now));
    }

    if (intents.vaccineInfo) {
      return respond({
        intent: 'VACCINE_INFO',
        reply: vaccineGuide(detectSpeciesPrefix(message) ?? this.speciesPrefixOf(draft, ctx)),
        quickReplies: ['Đặt lịch tiêm phòng', 'Lịch tiêm phòng của bé'],
        suggestBooking: true,
      });
    }

    const choosingSlot =
      (draft.offeredSlots?.length ?? 0) > 0 &&
      (parseChoiceIndex(message) !== undefined || !!parseTime(message).time);
    const bookingTurn =
      intents.booking ||
      !!draft.active ||
      choosingSlot ||
      (intents.affirm && awaiting.has('bookingConsent'));
    if (bookingTurn) {
      this.mergeBookingFacts(message, draft, ctx, awaiting, now);
    }

    const hasMedia = images.length > 0 || videos.length > 0;
    let triage: ChatTriage | undefined;
    let assessment = '';
    if (intents.symptom || hasMedia) {
      draft.symptoms = [draft.symptoms, message].filter(Boolean).join('\n').slice(-2000);
      const result = await this.runTriage(draft, ctx);
      if (result) {
        // Phân loại dự phòng theo từ khoá chỉ đọc chữ - không được nói là đã xem ảnh/video.
        const sawMedia = result.modelVersion !== KEYWORD_TRIAGE_MODEL_VERSION;
        draft.priorityColor = result.priorityColor;
        triage = {
          priorityColor: result.priorityColor,
          reasoning: triageReasoning(result),
          suspectedDiseases: result.suspectedGroups.slice(0, 3),
          analyzedImages: sawMedia ? (draft.photoUrls?.length ?? 0) : 0,
          analyzedVideos: sawMedia ? (draft.videoUrls?.length ?? 0) : 0,
        };
      }
      assessment = buildAssessment(triage, hasMedia);
    }

    if (bookingTurn) {
      const outcome = await this.continueBooking(draft, ctx, now, message);
      return respond({
        intent: 'BOOKING',
        reply: assessment ? `${assessment}\n\n---\n\n${outcome.reply}` : outcome.reply,
        missingFields: outcome.missingFields,
        quickReplies: outcome.quickReplies,
        suggestBooking: !outcome.booking,
        triage,
        booking: outcome.booking,
        notifications: outcome.notifications,
      });
    }

    if (triage || assessment) {
      draft.awaiting = ['bookingConsent'];
      const blue = triage?.priorityColor === PriorityColor.BLUE;
      return respond({
        intent: 'TRIAGE',
        reply:
          `${assessment}\n\n` +
          (blue
            ? 'Nếu bạn vẫn muốn bác sĩ kiểm tra cho yên tâm, em có thể đặt lịch khám ngay.'
            : '👉 Bạn có muốn em **đặt lịch khám** cho bé luôn không ạ?'),
        quickReplies: ['Đặt lịch khám ngay'],
        suggestBooking: !blue,
        triage,
      });
    }

    if (intents.greeting) {
      return respond({
        intent: 'GREETING',
        reply:
          `Xin chào${ctx.owner ? ` ${ctx.owner.fullName}` : ''}! Em là **Trợ lý AI VetCare**. Em có thể:\n` +
          '1. **Đánh giá sơ bộ sức khoẻ** của bé qua mô tả, ảnh hoặc video triệu chứng.\n' +
          '2. **Đặt lịch khám tự động** - em sẽ hỏi những gì còn thiếu.\n' +
          '3. **Tra cứu lịch tiêm phòng và lịch tái khám** của bé (khi bạn đã đăng nhập).\n\n' +
          'Lịch hẹn, lịch tiêm và lịch tái khám đều được nhắc qua **Zalo** và **Gmail**.',
        quickReplies: ['Đặt lịch khám', 'Lịch tiêm phòng của bé'],
      });
    }

    if (intents.thanks) {
      return respond({
        intent: 'THANKS',
        reply: 'Dạ không có gì ạ! Chúc bé luôn khoẻ mạnh. Cần gì bạn cứ nhắn em nhé 🐾',
      });
    }

    // Tin rỗng/vô nghĩa ("   ", "?") không đáng một lượt gọi LLM.
    const answer = /[\p{L}\d]{2,}/u.test(message)
      ? await this.answerGeneralQuestion(message)
      : null;
    if (answer) {
      return respond({
        intent: 'HELP',
        reply: answer.answer,
        quickReplies: answer.suggestVisit
          ? ['Đặt lịch khám', 'Lịch tiêm phòng của bé']
          : ['Đặt lịch khám', 'Lịch tiêm phòng của bé', 'Kiểm tra lịch tái khám'],
        suggestBooking: answer.suggestVisit,
      });
    }

    return respond({
      intent: 'HELP',
      reply:
        'Dạ em chưa hiểu rõ ý bạn. Bạn có thể:\n' +
        '- **Mô tả triệu chứng** của bé (hoặc gửi ảnh/video) để em đánh giá sơ bộ;\n' +
        '- Nhắn **"Đặt lịch khám"** để em đặt lịch giúp bạn;\n' +
        '- Hỏi **lịch tiêm phòng / lịch tái khám** của bé.',
      quickReplies: ['Đặt lịch khám', 'Lịch tiêm phòng của bé', 'Kiểm tra lịch tái khám'],
    });
  }

  // ------------------------------------------------------------- ngữ cảnh

  private async loadContext(actor: AuthenticatedUser | null): Promise<ChatContext> {
    const [branches, services, species, breeds] = await Promise.all([
      this.branchesRepository.find({ where: { active: true }, order: { branchName: 'ASC' } }),
      this.servicesRepository.find({ where: { active: true }, relations: ['item'] }),
      this.speciesRepository.find(),
      this.breedsRepository.find(),
    ]);

    let owner: User | null = null;
    let pets: Pet[] = [];
    if (actor?.role === Role.PET_OWNER) {
      owner = await this.usersRepository.findOne({ where: { id: actor.userId, active: true } });
      if (owner) {
        pets = await this.petsRepository.find({
          where: { ownerId: owner.id },
          relations: ['breed', 'breed.species'],
          order: { createdAt: 'ASC' },
        });
      }
    }

    return { branches, services, species, breeds, owner, pets };
  }

  /** Bỏ mọi id trong draft không còn hợp lệ hoặc không thuộc về người đang chat. */
  private sanitizeDraft(input: BookingDraftDto, ctx: ChatContext): BookingDraft {
    const draft: BookingDraft = { ...input };
    if (draft.branchId && !ctx.branches.some((b) => b.id === draft.branchId))
      draft.branchId = undefined;
    if (draft.serviceId && !ctx.services.some((s) => s.id === draft.serviceId))
      draft.serviceId = undefined;
    if (draft.speciesId && !ctx.species.some((s) => s.id === draft.speciesId))
      draft.speciesId = undefined;
    if (draft.breedId && !ctx.breeds.some((b) => b.id === draft.breedId)) draft.breedId = undefined;
    if (draft.petId) {
      const pet = ctx.pets.find((p) => p.id === draft.petId);
      if (pet) {
        this.applyExistingPet(draft, pet);
      } else {
        draft.petId = undefined;
      }
    }
    if (ctx.owner) {
      draft.phone = undefined;
      draft.ownerFullName = undefined;
      draft.email = undefined;
    }
    return draft;
  }

  private applyExistingPet(draft: BookingDraft, pet: Pet): void {
    draft.petId = pet.id;
    draft.petName = pet.name;
    draft.breedId = pet.breedId;
    draft.speciesId = pet.breed?.speciesId;
    draft.gender = pet.gender;
  }

  private clearBooking(draft: BookingDraft): void {
    const keep = { phone: draft.phone, ownerFullName: draft.ownerFullName, email: draft.email };
    for (const key of Object.keys(draft) as Array<keyof BookingDraft>) delete draft[key];
    Object.assign(draft, keep);
  }

  // ------------------------------------------------------------- trích thông tin

  private mergePetFacts(
    message: string,
    draft: BookingDraft,
    ctx: ChatContext,
    awaiting: Set<string>,
  ): void {
    if (ctx.pets.length > 0) {
      const chosen = matchOption(
        message,
        ctx.pets.map((pet) => ({ id: pet.id, aliases: [pet.name] })),
      );
      if (chosen) {
        this.applyExistingPet(
          draft,
          ctx.pets.find((p) => p.id === chosen)!,
        );
        return;
      }
    }

    const name = extractPetName(message, awaiting.has('petName') || awaiting.has('petChoice'));
    if (name && normalizeText(name) !== normalizeText(draft.petName ?? '')) {
      // Đổi sang bé KHÁC thì bỏ loài/giới tính của bé cũ; còn đặt tên lần đầu cho bé đã
      // được mô tả ("bé cún nhà em bị nôn" rồi mới nói "bé tên Mon") thì giữ nguyên.
      if (draft.petName || draft.petId) {
        draft.speciesId = undefined;
        draft.breedId = undefined;
        draft.gender = undefined;
      }
      draft.petId = undefined;
      draft.petName = name;
    }
    if (draft.petId) return;

    const breedId = matchOption(message, this.breedOptions(ctx));
    if (breedId) {
      draft.breedId = breedId;
      draft.speciesId = ctx.breeds.find((b) => b.id === breedId)?.speciesId;
    }

    const prefix = detectSpeciesPrefix(message);
    const species = prefix
      ? ctx.species.find((s) => stripDiacritics(s.speciesName).startsWith(prefix))
      : undefined;
    if (species && species.id !== draft.speciesId) {
      draft.speciesId = species.id;
      if (
        draft.breedId &&
        ctx.breeds.find((b) => b.id === draft.breedId)?.speciesId !== species.id
      ) {
        draft.breedId = undefined;
      }
    }

    const gender = detectGender(message);
    if (gender) draft.gender = gender === 'MALE' ? Gender.MALE : Gender.FEMALE;
  }

  private mergeBookingFacts(
    message: string,
    draft: BookingDraft,
    ctx: ChatContext,
    awaiting: Set<string>,
    now: Date,
  ): void {
    draft.active = true;

    const branchId = matchOption(message, this.branchOptions(ctx));
    if (branchId) {
      draft.branchId = branchId;
    } else if (
      ctx.branches.length > 0 &&
      /(?:gan nhat|nao cung duoc|dau cung duoc|chi nhanh nao cung)/.test(stripDiacritics(message))
    ) {
      draft.branchId = ctx.branches[0].id;
    }

    const serviceId = matchOption(message, this.serviceOptions(ctx));
    if (serviceId) draft.serviceId = serviceId;

    const choice = parseChoiceIndex(message);
    const offered = draft.offeredSlots ?? [];
    if (choice !== undefined && offered[choice]) {
      const slot = new Date(offered[choice]);
      draft.date = format(slot, 'yyyy-MM-dd');
      draft.time = format(slot, 'HH:mm');
      draft.offeredSlots = undefined;
    } else {
      const date = parseDate(message, now);
      const { time, period } = parseTime(message);
      if (date) draft.date = date;
      if (time) {
        draft.time = time;
        draft.period = period;
      } else if (period) {
        // "Sáng Thứ 2" sau khi đã nói "9h": giữ 9h vì vẫn thuộc buổi sáng; chỉ bỏ giờ cũ khi
        // khách đổi sang buổi khác ("à thôi, buổi chiều").
        const keepsTime = draft.time && draft.time < NOON === (period === 'morning');
        if (!keepsTime) draft.time = undefined;
        draft.period = period;
      }
      if (date || time || period) draft.offeredSlots = undefined;
    }

    if (!ctx.owner) {
      const phone = extractPhone(message);
      const email = extractEmail(message);
      const ownerName = extractOwnerName(message, awaiting.has('ownerName'));
      if (phone) draft.phone = phone;
      if (email) draft.email = email;
      if (ownerName && ownerName !== draft.petName) draft.ownerFullName = ownerName;
    }
  }

  private branchOptions(ctx: ChatContext): NamedOption[] {
    return ctx.branches.map((branch) => {
      const aliases = [branch.branchName];
      const district = stripDiacritics(branch.branchName).match(/quan\s+(\d+)/);
      if (district) {
        const n = district[1];
        aliases.push(`quận ${n}`, `quan ${n}`, `q${n}`, `q ${n}`, `q.${n}`);
      }
      const short = branch.branchName.replace(/^phòng khám( thú y)?/i, '').trim();
      if (short && short !== branch.branchName) aliases.push(short);
      return { id: branch.id, aliases };
    });
  }

  private serviceOptions(ctx: ChatContext): NamedOption[] {
    const keywords: Array<[string, string[]]> = [
      ['tiem', ['tiêm', 'tiêm phòng', 'vắc xin', 'vắc-xin', 'vacxin', 'vaccine']],
      ['sieu am', ['siêu âm']],
      ['phau thuat', ['phẫu thuật', 'mổ']],
      ['da lieu', ['da liễu', 'khám da']],
      ['tong quat', ['tổng quát', 'khám sức khoẻ', 'khám sức khỏe', 'kiểm tra sức khoẻ']],
    ];
    return ctx.services.map((service) => {
      const name = service.item?.itemName ?? '';
      const plain = stripDiacritics(name);
      const extra = keywords.filter(([key]) => plain.includes(key)).flatMap(([, words]) => words);
      return { id: service.id, aliases: [name, ...extra] };
    });
  }

  private breedOptions(ctx: ChatContext): NamedOption[] {
    return ctx.breeds
      .filter((breed) => !/giong khac|chua xac dinh/.test(stripDiacritics(breed.breedName)))
      .map((breed) => ({ id: breed.id, aliases: nameAliases(breed.breedName) }));
  }

  private speciesPrefixOf(draft: BookingDraft, ctx: ChatContext): string | undefined {
    const species = ctx.species.find((s) => s.id === draft.speciesId);
    return species ? stripDiacritics(species.speciesName).split(' ')[0] : undefined;
  }

  // ------------------------------------------------------------- đánh giá AI

  private async runTriage(draft: BookingDraft, ctx: ChatContext): Promise<AiTriageResult | null> {
    const species = ctx.species.find((s) => s.id === draft.speciesId);
    const breed = ctx.breeds.find((b) => b.id === draft.breedId);
    const pet = ctx.pets.find((p) => p.id === draft.petId);
    try {
      return await this.aiProvider.triage({
        symptomText: draft.symptoms ?? '',
        symptomCodes: [],
        photoUrls: draft.photoUrls ?? [],
        videoUrls: draft.videoUrls ?? [],
        petSpecies: species?.speciesName,
        petBreed:
          breed && !/giong khac/.test(stripDiacritics(breed.breedName))
            ? breed.breedName
            : undefined,
        petGender: draft.gender,
        petWeight: pet?.weight != null ? Number(pet.weight) : undefined,
        petAgeYears: pet?.birthDate
          ? differenceInMonths(new Date(), new Date(pet.birthDate)) / 12
          : undefined,
      });
    } catch (error) {
      this.logger.warn(`AI triage thất bại: ${(error as Error).message}`);
      return null;
    }
  }

  /** Câu hỏi ngoài các ý định đã biết: nhờ LLM trả lời; lỗi thì để nhánh HELP dùng câu cố định. */
  private async answerGeneralQuestion(question: string): Promise<AiPetCareAnswer | null> {
    try {
      return await this.aiProvider.answerPetCareQuestion({ question });
    } catch (error) {
      this.logger.warn(`AI hỏi đáp chung thất bại: ${(error as Error).message}`);
      return null;
    }
  }

  // ------------------------------------------------------------- đặt lịch

  private async continueBooking(
    draft: BookingDraft,
    ctx: ChatContext,
    now: Date,
    message: string,
  ): Promise<BookingOutcome> {
    const notes: string[] = [];
    if (hasInvalidDateText(message) && !parseDate(message, now)) {
      notes.push('Ngày bạn nhập không có trên lịch, bạn kiểm tra lại giúp em nhé.');
    }

    if (ctx.owner && ctx.pets.length === 1 && !draft.petId && !draft.petName) {
      this.applyExistingPet(draft, ctx.pets[0]);
      notes.push(`Em đặt cho bé **${draft.petName}** (bé duy nhất trong hồ sơ của bạn).`);
    }
    if (!draft.branchId && ctx.branches.length === 1) draft.branchId = ctx.branches[0].id;

    // Kiểm tra ngày NGAY khi khách nói, trước khi hỏi các thông tin khác - không để khách
    // khai đủ mọi thứ rồi mới biết hôm nay không đặt trực tuyến được.
    if (draft.date && new Date(`${draft.date}T23:59:59`) < earliestSelfBookableStart(now)) {
      const urgent =
        draft.priorityColor === PriorityColor.RED || draft.priorityColor === PriorityColor.ORANGE;
      draft.date = undefined;
      draft.offeredSlots = undefined;
      notes.push(
        'Lịch hẹn trực tuyến chỉ nhận **từ ngày mai** trở đi. ' +
          (urgent
            ? 'Với tình trạng hiện tại của bé, bạn hãy **đưa bé tới phòng khám ngay hôm nay** hoặc gọi hotline nhé.'
            : 'Nếu cần khám trong hôm nay, bạn vui lòng tới trực tiếp hoặc gọi cho quầy lễ tân.'),
      );
    }

    // Ngày chi nhánh nghỉ (cuối tuần, không có giờ mở cửa): báo ngay, không đợi khách khai
    // hết SĐT/họ tên rồi mới nói "không còn bác sĩ trống".
    if (draft.date && draft.branchId && !(await this.isBranchOpen(draft.branchId, draft.date))) {
      const branchName =
        ctx.branches.find((b) => b.id === draft.branchId)?.branchName ?? 'Chi nhánh';
      notes.push(
        `**${branchName}** không làm việc vào **${formatWeekday(draft.date)}**, bạn chọn ngày khác giúp em nhé.`,
      );
      draft.date = undefined;
      draft.offeredSlots = undefined;
    }

    const missing = this.missingFields(draft, ctx);
    if (missing.length > 0) {
      const dateSuggestions = missing.includes('date')
        ? await this.dateSuggestions(draft.branchId ?? ctx.branches[0]?.id, now)
        : [];
      return this.askForMissing(draft, ctx, missing, notes, dateSuggestions);
    }

    const branch = ctx.branches.find((b) => b.id === draft.branchId)!;
    const service = this.resolveService(draft, ctx);
    if (!service) {
      return {
        reply:
          'Dạ hiện phòng khám chưa mở dịch vụ khám nào để đặt trực tuyến. Bạn vui lòng gọi lễ tân giúp em nhé.',
        missingFields: [],
        quickReplies: [],
      };
    }

    const freeStarts = await this.findFreeStarts(
      branch.id,
      service.durationMinutes,
      draft.date!,
      now,
    );
    let startAt: Date | undefined;
    if (draft.time) {
      const requested = new Date(`${draft.date}T${draft.time}:00`);
      startAt = freeStarts.find((s) => s.getTime() === requested.getTime());
    } else {
      startAt = freeStarts.find((s) =>
        draft.period === 'afternoon' ? format(s, 'HH:mm') >= NOON : format(s, 'HH:mm') < NOON,
      );
    }

    if (!startAt) {
      return this.offerAlternatives(draft, branch, service, freeStarts, now);
    }

    return this.book(draft, ctx, branch, service, startAt, notes);
  }

  private missingFields(draft: BookingDraft, ctx: ChatContext): string[] {
    const missing: string[] = [];
    if (!draft.petId) {
      if (ctx.owner && ctx.pets.length > 1 && !draft.petName) {
        missing.push('petChoice');
      } else {
        if (!draft.petName) missing.push('petName');
        if (!draft.speciesId) missing.push('species');
        if (!draft.gender) missing.push('gender');
      }
    }
    if (!draft.branchId) missing.push('branch');
    if (!draft.date) missing.push('date');
    if (!draft.time && !draft.period) missing.push('time');
    if (!ctx.owner) {
      if (!draft.phone) missing.push('phone');
      if (!draft.ownerFullName) missing.push('ownerName');
    }
    return missing;
  }

  private askForMissing(
    draft: BookingDraft,
    ctx: ChatContext,
    missing: string[],
    notes: string[],
    dateSuggestions: string[],
  ): BookingOutcome {
    draft.awaiting = missing;
    const known = this.describeKnown(draft, ctx);
    const questions = missing
      .filter((field) => !(field === 'time' && missing.includes('date')))
      .map((field) => {
        if (field === 'date')
          return 'Bạn muốn đưa bé tới **ngày nào, mấy giờ** (ví dụ: sáng mai 9h, thứ 6 lúc 14h)?';
        if (field === 'phone' && !draft.email) {
          return `${FIELD_QUESTIONS.phone} (kèm **email** nếu muốn nhận thêm qua Gmail)`;
        }
        if (field === 'branch') {
          return `${FIELD_QUESTIONS.branch} (${ctx.branches.map((b) => b.branchName).join(' / ')})`;
        }
        if (field === 'petChoice') {
          return `${FIELD_QUESTIONS.petChoice} (${ctx.pets.map((p) => p.name).join(', ')})`;
        }
        return FIELD_QUESTIONS[field];
      });

    let quickReplies: string[] = [];
    if (missing.includes('petChoice')) quickReplies = ctx.pets.map((p) => p.name);
    else if (missing.includes('branch')) quickReplies = ctx.branches.map((b) => b.branchName);
    else if (missing.includes('gender') && missing.length <= 2) quickReplies = ['Đực', 'Cái'];
    else if (missing.includes('date')) quickReplies = dateSuggestions;
    else if (missing.includes('time')) quickReplies = ['Buổi sáng', 'Buổi chiều'];

    const intro =
      known.length > 0
        ? `Dạ em đã ghi nhận: ${known.join(', ')}.`
        : 'Dạ em sẽ đặt lịch khám giúp bạn!';
    return {
      reply:
        [intro, ...notes].join(' ') +
        `\n\nĐể hoàn tất lịch hẹn, bạn cho em biết thêm:\n` +
        questions.map((q, i) => `${i + 1}. ${q}`).join('\n') +
        '\n\nBạn trả lời chung trong một tin nhắn cũng được, đủ thông tin là em đặt lịch ngay.',
      missingFields: missing,
      quickReplies,
    };
  }

  private describeKnown(draft: BookingDraft, ctx: ChatContext): string[] {
    const known: string[] = [];
    const species = ctx.species.find((s) => s.id === draft.speciesId);
    if (draft.petName) {
      const genderLabel =
        draft.gender === Gender.MALE ? ', đực' : draft.gender === Gender.FEMALE ? ', cái' : '';
      known.push(
        `bé **${draft.petName}**${species ? ` (${species.speciesName}${genderLabel})` : ''}`,
      );
    } else if (species) {
      known.push(`loài **${species.speciesName}**`);
    }
    const branch = ctx.branches.find((b) => b.id === draft.branchId);
    if (branch) known.push(`chi nhánh **${branch.branchName}**`);
    const service = ctx.services.find((s) => s.id === draft.serviceId);
    if (service?.item) known.push(`dịch vụ **${service.item.itemName}**`);
    if (draft.date) {
      const when =
        draft.time ??
        (draft.period === 'afternoon'
          ? 'buổi chiều'
          : draft.period === 'morning'
            ? 'buổi sáng'
            : '');
      known.push(`thời gian **${[when, formatDay(draft.date)].filter(Boolean).join(' ')}**`);
    }
    if (draft.phone) known.push(`SĐT **${draft.phone}**`);
    return known;
  }

  private resolveService(draft: BookingDraft, ctx: ChatContext): Service | undefined {
    return (
      ctx.services.find((s) => s.id === draft.serviceId) ??
      ctx.services.find((s) => /tong quat/.test(stripDiacritics(s.item?.itemName ?? ''))) ??
      ctx.services.find((s) => /kham/.test(stripDiacritics(s.item?.itemName ?? ''))) ??
      ctx.services[0]
    );
  }

  /**
   * Mọi giờ bắt đầu còn ÍT NHẤT một bác sĩ của chi nhánh trống đủ thời lượng dịch vụ -
   * cùng nguồn sự thật (AvailabilityService) với lịch đặt trên web, nên không bao giờ
   * đề xuất giờ ngoài ca/giờ nghỉ.
   */
  private async findFreeStarts(
    branchId: string,
    durationMinutes: number,
    date: string,
    now: Date,
  ): Promise<Date[]> {
    const doctors = await this.doctorsRepository.find({ where: { branchId, active: true } });
    const earliest = earliestSelfBookableStart(now).getTime();
    const day = new Date(`${date}T00:00:00`);
    const starts = new Map<number, Date>();

    for (const doctor of doctors) {
      const availability = await this.availabilityService.getDoctorDayAvailability(
        doctor.id,
        branchId,
        day,
      );
      for (const slot of availability.slots) {
        if (slot.status !== SlotStatus.FREE || slot.startAt.getTime() < earliest) continue;
        const covered = slotsCovering(
          availability.slots,
          slot.startAt,
          addMinutes(slot.startAt, durationMinutes),
        );
        if (covered?.every((s) => s.status === SlotStatus.FREE)) {
          starts.set(slot.startAt.getTime(), slot.startAt);
        }
      }
    }

    return [...starts.values()].sort((a, b) => a.getTime() - b.getTime());
  }

  private async isBranchOpen(branchId: string, date: string): Promise<boolean> {
    const doctor = await this.doctorsRepository.findOne({ where: { branchId, active: true } });
    if (!doctor) return false;
    const day = await this.availabilityService.getDoctorDayAvailability(
      doctor.id,
      branchId,
      new Date(`${date}T00:00:00`),
    );
    return day.isBranchOpen;
  }

  /**
   * Nút gợi ý ngày: 2 ngày mở cửa gần nhất của chi nhánh ("Sáng Thứ 2 19/10"...). Gợi ý cố
   * định "Sáng mai" từng trỏ vào thứ 7/CN - đúng ngày phòng khám nghỉ.
   */
  private async dateSuggestions(branchId: string | undefined, now: Date): Promise<string[]> {
    if (!branchId) return [];
    const open: Date[] = [];
    for (let offset = 1; offset <= 10 && open.length < 2; offset++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      if (await this.isBranchOpen(branchId, format(day, 'yyyy-MM-dd'))) open.push(day);
    }
    const label = (d: Date) => `${WEEKDAY_LABELS[d.getDay()]} ${format(d, 'dd/MM')}`;
    return open.flatMap((d) => [`Sáng ${label(d)}`, `Chiều ${label(d)}`]).slice(0, 3);
  }

  private async offerAlternatives(
    draft: BookingDraft,
    branch: Branch,
    service: Service,
    sameDay: Date[],
    now: Date,
  ): Promise<BookingOutcome> {
    const target = new Date(
      `${draft.date}T${draft.time ?? (draft.period === 'afternoon' ? '14:00' : '09:00')}:00`,
    );
    const options = [...sameDay]
      .sort(
        (a, b) =>
          Math.abs(a.getTime() - target.getTime()) - Math.abs(b.getTime() - target.getTime()),
      )
      .slice(0, MAX_ALTERNATIVES)
      .sort((a, b) => a.getTime() - b.getTime());

    if (options.length === 0) {
      for (
        let offset = 1;
        offset <= SEARCH_DAYS_AHEAD && options.length < MAX_ALTERNATIVES;
        offset++
      ) {
        const next = new Date(`${draft.date}T00:00:00`);
        next.setDate(next.getDate() + offset);
        const free = await this.findFreeStarts(
          branch.id,
          service.durationMinutes,
          format(next, 'yyyy-MM-dd'),
          now,
        );
        // Ngày kế tiếp: ưu tiên giờ gần giờ khách muốn nhất (9h thì đề xuất 9h, không phải 7h).
        const wantedMinutes = target.getHours() * 60 + target.getMinutes();
        const byCloseness = [...free].sort(
          (a, b) =>
            Math.abs(a.getHours() * 60 + a.getMinutes() - wantedMinutes) -
            Math.abs(b.getHours() * 60 + b.getMinutes() - wantedMinutes),
        );
        options.push(
          ...byCloseness
            .slice(0, MAX_ALTERNATIVES - options.length)
            .sort((a, b) => a.getTime() - b.getTime()),
        );
      }
    }

    const asked = draft.time
      ? `**${draft.time} ${formatDay(draft.date!)}**`
      : `**buổi ${draft.period === 'afternoon' ? 'chiều' : 'sáng'} ${formatDay(draft.date!)}**`;

    if (options.length === 0) {
      draft.date = undefined;
      draft.time = undefined;
      draft.awaiting = ['date'];
      return {
        reply:
          `Dạ ${asked} và cả tuần sau đó tại **${branch.branchName}** đều đã kín lịch. ` +
          'Bạn thử chọn chi nhánh khác hoặc một ngày xa hơn giúp em nhé.',
        missingFields: ['date'],
        quickReplies: [],
      };
    }

    draft.time = undefined;
    draft.offeredSlots = options.map((o) => o.toISOString());
    draft.awaiting = ['slotChoice'];
    const labels = options.map((o) => formatSlot(o));
    return {
      reply:
        `Dạ ${asked} tại **${branch.branchName}** ` +
        (sameDay.length === 0
          ? 'đã kín lịch cả ngày. '
          : 'không còn bác sĩ trống (đã kín lịch hoặc ngoài giờ làm việc). ') +
        `Các giờ trống gần nhất:\n` +
        labels.map((label, i) => `${i + 1}. ${label}`).join('\n') +
        '\n\nBạn chọn giờ nào (gõ số thứ tự hoặc giờ khác) em đặt ngay ạ.',
      missingFields: ['slotChoice'],
      quickReplies: labels,
    };
  }

  private async book(
    draft: BookingDraft,
    ctx: ChatContext,
    branch: Branch,
    service: Service,
    startAt: Date,
    notes: string[],
  ): Promise<BookingOutcome> {
    const phone = ctx.owner?.phone ?? draft.phone!;
    const petId = draft.petId ?? (await this.findExistingGuestPet(phone, draft.petName));
    // SĐT đã có hồ sơ thì lịch gắn vào hồ sơ đó và GIỮ tên cũ (khách chưa đăng nhập không
    // được đổi tên tài khoản của người khác) - lấy trước để báo rõ cho khách.
    const existingOwner = ctx.owner
      ? null
      : await this.usersRepository.findOne({
          where: { phone },
          select: { id: true, fullName: true },
        });

    const dto: CreateBookingDto = {
      phone,
      ownerFullName: ctx.owner?.fullName ?? draft.ownerFullName,
      email: ctx.owner ? (ctx.owner.email ?? undefined) : draft.email,
      branchId: branch.id,
      serviceId: service.id,
      startAt: startAt.toISOString(),
      ...(petId
        ? { petId }
        : {
            newPet: {
              name: draft.petName!,
              speciesId: draft.speciesId,
              breedId: draft.breedId ?? this.genericBreedId(ctx, draft.speciesId!),
              gender: draft.gender ?? Gender.ASEXUAL,
            },
          }),
      commonSymptoms: [],
      otherSymptoms: draft.symptoms ? `[Trợ lý AI] ${draft.symptoms}` : undefined,
      photoUrls: draft.photoUrls ?? [],
      videoUrls: draft.videoUrls ?? [],
    };

    try {
      const { appointment, notifications } = await this.appointmentsService.createBookingWithReport(
        dto,
        null,
      );
      const booking: ChatBooking = {
        id: appointment.id,
        code: appointment.id.slice(0, 8).toUpperCase(),
        petName: appointment.pet?.name ?? draft.petName ?? 'Thú cưng',
        branchName: branch.branchName,
        branchAddress: branch.address,
        serviceName: service.item?.itemName ?? 'Khám tổng quát',
        doctorName:
          (await this.doctorsRepository.findOne({ where: { id: appointment.doctorId } }))
            ?.fullName ?? null,
        startAt: appointment.startAt.toISOString(),
        status: appointment.status,
      };
      // Khách vãng lai không được đổi email của một hồ sơ SĐT đã có (resolveOwner giữ nguyên
      // liên hệ cũ) - nói rõ thay vì để khách tưởng tin đã tới Gmail.
      const emailIgnored =
        !ctx.owner &&
        !!draft.email &&
        !!notifications &&
        !notifications.deliveries.some((d) => d.channel === 'EMAIL');
      const ownerNameKept =
        existingOwner &&
        draft.ownerFullName &&
        normalizeText(existingOwner.fullName) !== normalizeText(draft.ownerFullName)
          ? existingOwner.fullName
          : null;
      this.clearBooking(draft);

      return {
        reply:
          (notes.length > 0 ? `${notes.join(' ')}\n\n` : '') +
          `🎉 **Đặt lịch thành công!**\n` +
          `- Bé: **${booking.petName}**\n` +
          `- Thời gian: **${formatSlot(appointment.startAt)}**\n` +
          `- Chi nhánh: **${branch.branchName}** - ${branch.address}\n` +
          `- Dịch vụ: **${booking.serviceName}**\n` +
          (booking.doctorName ? `- Bác sĩ khám: **${booking.doctorName}**\n` : '') +
          `- Mã lịch hẹn: **#${booking.code}**\n\n` +
          describeDeliveries(notifications) +
          (emailIgnored
            ? '_Số điện thoại này đã có hồ sơ tại phòng khám nên tin được gửi theo liên hệ trong ' +
              'hồ sơ; muốn nhận thêm qua Gmail, bạn đăng nhập để cập nhật email hoặc báo lễ tân._\n'
            : '') +
          (ownerNameKept
            ? `_Số điện thoại này đã có hồ sơ tại phòng khám mang tên **${ownerNameKept}** nên ` +
              'lịch hẹn được ghi theo hồ sơ đó. Muốn đổi tên, bạn đăng nhập để sửa hồ sơ hoặc ' +
              'báo lễ tân._\n'
            : '') +
          '\nPhòng khám sẽ nhắc lại trước giờ hẹn. Bạn nhớ đưa bé tới đúng giờ nhé!',
        missingFields: [],
        quickReplies: [],
        booking,
        notifications,
      };
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) {
        draft.time = undefined;
        draft.offeredSlots = undefined;
        draft.awaiting = ['time'];
        const detail = error.message;
        return {
          reply: `Dạ em chưa đặt được lịch: ${detail}. Bạn chọn giúp em một giờ khác nhé.`,
          missingFields: ['time'],
          quickReplies: ['Buổi sáng', 'Buổi chiều'],
        };
      }
      this.logger.error(
        `Đặt lịch qua trợ lý thất bại: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        reply:
          'Dạ hệ thống đặt lịch đang gặp sự cố, em chưa đặt được. Bạn thử lại sau ít phút hoặc gọi lễ tân giúp em nhé.',
        missingFields: [],
        quickReplies: [],
      };
    }
  }

  /**
   * Khách vãng lai đặt lại cho bé ĐÃ có hồ sơ (cùng SĐT, cùng tên bé): dùng lại hồ sơ đó
   * thay vì sinh thêm một bé trùng tên mỗi lần đặt. Không trả gì về cho khách ngoài tên
   * bé chính họ vừa gõ, nên không lộ dữ liệu của chủ số điện thoại.
   */
  private async findExistingGuestPet(phone: string, petName?: string): Promise<string | undefined> {
    if (!petName) return undefined;
    const owner = await this.usersRepository.findOne({ where: { phone } });
    if (!owner) return undefined;
    const pets = await this.petsRepository.find({ where: { ownerId: owner.id } });
    const wanted = stripDiacritics(petName);
    return pets.find((p) => stripDiacritics(p.name) === wanted)?.id;
  }

  private genericBreedId(ctx: ChatContext, speciesId: string): string {
    const ofSpecies = ctx.breeds.filter((b) => b.speciesId === speciesId);
    return (
      ofSpecies.find((b) => /giong khac|chua xac dinh/.test(stripDiacritics(b.breedName))) ??
      ofSpecies.find((b) => /\bta\b|\bco\b/.test(stripDiacritics(b.breedName))) ??
      ofSpecies[0]
    ).id;
  }

  // ------------------------------------------------------------- tra cứu lịch

  private async handleScheduleLookup(
    ctx: ChatContext,
    now: Date,
  ): Promise<
    Pick<AssistantChatResponse, 'reply' | 'intent' | 'requiresLogin' | 'schedule' | 'quickReplies'>
  > {
    if (!ctx.owner) {
      return {
        intent: 'SCHEDULE_LOOKUP',
        requiresLogin: true,
        quickReplies: [],
        reply:
          'Dạ để bảo vệ thông tin của bé, em chỉ tra cứu được **lịch tiêm phòng** và **lịch tái khám** ' +
          'khi bạn đã **đăng nhập** tài khoản chủ nuôi. Bạn đăng nhập rồi hỏi lại em nhé!\n\n' +
          'Dù chưa đăng nhập, phòng khám vẫn tự nhắc lịch tiêm và lịch tái khám qua **Zalo/Gmail** theo số điện thoại bạn đã đăng ký.',
      };
    }

    const today = format(now, 'yyyy-MM-dd');
    const vaccinations: ChatSchedule['vaccinations'] = (
      await this.dataSource.query(
        `
        SELECT * FROM (
          SELECT DISTINCT ON (v."pet_id", v."vaccine_id")
                 pet."name"                               AS "petName",
                 item."item_name"                         AS "vaccineName",
                 to_char(v."next_due_date", 'YYYY-MM-DD') AS "nextDueDate"
            FROM "vaccinations" v
            JOIN "pets" pet ON pet."id" = v."pet_id" AND pet."deleted_at" IS NULL
            JOIN "vaccines" vaccine ON vaccine."id" = v."vaccine_id"
            JOIN "items" item ON item."id" = vaccine."item_id"
           WHERE pet."owner_id" = $1
             AND v."deleted_at" IS NULL
           ORDER BY v."pet_id", v."vaccine_id", v."vaccinated_at" DESC, v."created_at" DESC
        ) latest
        WHERE "nextDueDate" IS NOT NULL AND "nextDueDate" >= to_char($2::date - 60, 'YYYY-MM-DD')
        ORDER BY "nextDueDate" ASC
        LIMIT 10
        `,
        [ctx.owner.id, today],
      )
    ).map((row: { petName: string; vaccineName: string; nextDueDate: string }) => ({
      ...row,
      overdue: row.nextDueDate < today,
    }));

    const appointments: ChatSchedule['appointments'] = (
      await this.dataSource.query(
        `
        SELECT a."id", pet."name" AS "petName", b."branch_name" AS "branchName",
               item."item_name" AS "serviceName", a."start_at" AS "startAt", a."status",
               (a."parent_appointment_id" IS NOT NULL) AS "isFollowUp"
          FROM "appointments" a
          JOIN "pets" pet ON pet."id" = a."pet_id" AND pet."deleted_at" IS NULL
          JOIN "branches" b ON b."id" = a."branch_id"
          LEFT JOIN "services" s ON s."id" = a."service_id"
          LEFT JOIN "items" item ON item."id" = s."item_id"
         WHERE pet."owner_id" = $1
           AND a."start_at" >= $2
           AND a."status" IN ('PENDING', 'CONFIRMED')
         ORDER BY a."start_at" ASC
         LIMIT 10
        `,
        [ctx.owner.id, now],
      )
    ).map((row: Omit<ChatSchedule['appointments'][number], 'startAt'> & { startAt: Date }) => ({
      ...row,
      startAt: new Date(row.startAt).toISOString(),
    }));

    const lines: string[] = [`Dạ đây là lịch của các bé nhà **${ctx.owner.fullName}**:`, ''];
    lines.push('💉 **Lịch tiêm phòng:**');
    if (vaccinations.length === 0) {
      lines.push('- Chưa có mũi tiêm nào đến hạn trong hồ sơ.');
    } else {
      for (const v of vaccinations) {
        lines.push(
          `- Bé **${v.petName}**: ${v.vaccineName} - ${v.overdue ? '**ĐÃ QUÁ HẠN** từ' : 'đến hạn'} ${formatDay(v.nextDueDate)}`,
        );
      }
    }
    lines.push('', '🩺 **Lịch hẹn & tái khám sắp tới:**');
    if (appointments.length === 0) {
      lines.push('- Chưa có lịch hẹn nào sắp tới.');
    } else {
      for (const a of appointments) {
        lines.push(
          `- ${a.isFollowUp ? '**[Tái khám]** ' : ''}Bé **${a.petName}**: ${formatSlot(new Date(a.startAt))} ` +
            `tại ${a.branchName}${a.serviceName ? ` (${a.serviceName})` : ''}`,
        );
      }
    }
    lines.push('', 'Phòng khám sẽ nhắc trước qua **Zalo** và **Gmail** (nếu hồ sơ có email).');

    const due = vaccinations.some(
      (v) => v.overdue || v.nextDueDate <= format(addMinutes(now, 60 * 24 * 14), 'yyyy-MM-dd'),
    );
    return {
      intent: 'SCHEDULE_LOOKUP',
      requiresLogin: false,
      reply: lines.join('\n'),
      schedule: { vaccinations, appointments },
      quickReplies: due ? ['Đặt lịch tiêm phòng'] : [],
    };
  }
}

// ------------------------------------------------------------------ định dạng

function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function formatWeekday(isoDate: string): string {
  return `${WEEKDAY_LABELS[new Date(`${isoDate}T00:00:00`).getDay()]} ${formatDay(isoDate)}`;
}

const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function formatSlot(date: Date): string {
  return `${format(date, 'HH:mm')} ${WEEKDAY_LABELS[date.getDay()]} ${format(date, 'dd/MM/yyyy')}`;
}

function triageReasoning(result: AiTriageResult): string | null {
  const triage = (result.raw as { triage_result?: { reasoning?: unknown } } | undefined)
    ?.triage_result;
  return typeof triage?.reasoning === 'string' && triage.reasoning.trim()
    ? triage.reasoning.trim()
    : null;
}

function buildAssessment(triage: ChatTriage | undefined, hasMedia: boolean): string {
  const danger =
    'Nếu bé có dấu hiệu nguy hiểm (khó thở, co giật, chảy máu, bỏ ăn uống hoàn toàn), bạn hãy đưa bé tới phòng khám ngay.';
  if (!triage && hasMedia) {
    // Chỉ có ảnh/video mà AI không đọc được: xin mô tả bằng chữ để lượt sau còn phân loại
    // theo từ khoá được, thay vì chỉ báo lỗi.
    return (
      'Em đã nhận ảnh/video của bé nhưng lúc này chưa đọc được ảnh tự động. ' +
      'Bạn mô tả giúp em bé đang có biểu hiện gì (nôn, tiêu chảy, ngứa, chảy máu, bỏ ăn...) và bao lâu rồi để em đánh giá mức độ nhé. ' +
      danger
    );
  }
  if (!triage) {
    return (
      'Dạ hiện hệ thống đánh giá AI đang tạm gián đoạn nên em chưa phân tích được triệu chứng. ' +
      danger
    );
  }
  const parts = [`🩺 **Mức độ ưu tiên:** ${PRIORITY_TEXT[triage.priorityColor]}`];
  if (triage.analyzedImages + triage.analyzedVideos > 0) {
    parts.push(
      `📷 Em đã phân tích kèm ${[
        triage.analyzedImages ? `${triage.analyzedImages} ảnh` : '',
        triage.analyzedVideos ? `${triage.analyzedVideos} video` : '',
      ]
        .filter(Boolean)
        .join(' và ')} bạn gửi.`,
    );
  }
  if (triage.reasoning) parts.push(`📋 **Nhận định sơ bộ:** ${triage.reasoning}`);
  if (triage.suspectedDiseases.length > 0) {
    parts.push(
      '🔍 **Khả năng tham khảo:**\n' +
        triage.suspectedDiseases
          .map((d, i) => `${i + 1}. ${d.name} (~${Math.round(d.confidence * 100)}%)`)
          .join('\n'),
    );
  }
  parts.push(`💡 ${PRIORITY_ADVICE[triage.priorityColor]}`);
  parts.push('_Đây là đánh giá sơ bộ của AI, không thay thế chẩn đoán của bác sĩ thú y._');
  return parts.join('\n\n');
}

function describeDeliveries(report: DeliveryReport | null | undefined): string {
  if (!report || report.deliveries.length === 0) {
    return '⚠️ Em chưa gửi được tin xác nhận - lễ tân sẽ liên hệ lại với bạn.\n';
  }
  const label = (channel: string) =>
    channel === 'EMAIL' ? 'Gmail' : channel === 'ZALO' ? 'Zalo' : channel;
  const sent = report.deliveries.filter((d) => d.status === 'SENT');
  const failed = report.deliveries.filter((d) => d.status !== 'SENT');
  const lines: string[] = [];
  if (sent.length > 0) {
    lines.push(
      `✅ Đã gửi tin xác nhận qua ${sent.map((d) => `${label(d.channel)} (${d.recipient})`).join(' và ')}.`,
    );
  }
  if (failed.length > 0) {
    lines.push(
      `⚠️ Chưa gửi được qua ${failed.map((d) => label(d.channel)).join(', ')} - hệ thống sẽ tự thử lại.`,
    );
  }
  if (report.simulated) {
    lines.push('_(Môi trường thử nghiệm: tin nhắn chỉ được ghi log, chưa gửi thật.)_');
  }
  return `${lines.join('\n')}\n`;
}

function vaccineGuide(speciesPrefix: string | undefined): string {
  const dog =
    '🐶 **Chó con** (tham khảo):\n' +
    '- 6-8 tuần tuổi: mũi 1 vắc-xin tổng hợp (5 hoặc 7 bệnh: Care, Parvo, viêm gan...)\n' +
    '- 9-11 tuần: mũi 2 · 12-14 tuần: mũi 3 + **dại**\n' +
    '- Sau đó nhắc lại vắc-xin tổng hợp và dại **mỗi năm một lần**';
  const cat =
    '🐱 **Mèo con** (tham khảo):\n' +
    '- 8-9 tuần tuổi: mũi 1 vắc-xin 4 bệnh (giảm bạch cầu, viêm mũi khí quản, Calici, Chlamydia)\n' +
    '- 12 tuần: mũi 2 + **dại** · 16 tuần: mũi 3 (nếu bác sĩ chỉ định)\n' +
    '- Sau đó nhắc lại **mỗi năm một lần**';
  const body = speciesPrefix === 'cho' ? dog : speciesPrefix === 'meo' ? cat : `${dog}\n\n${cat}`;
  return (
    `Dạ lịch tiêm phòng cơ bản như sau:\n\n${body}\n\n` +
    'Lịch cụ thể tuỳ thể trạng và loại vắc-xin - bác sĩ sẽ tư vấn khi khám. Sau mỗi mũi, phòng khám ' +
    'tự **nhắc lịch mũi kế tiếp qua Zalo/Gmail**. Bạn muốn em đặt lịch tiêm cho bé không ạ?'
  );
}

/** Dùng trong test: tách để không phải dựng cả service. */
export const __testing = { formatSlot, describeDeliveries, buildAssessment };
