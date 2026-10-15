import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Gender } from '@/shared/common/enums/gender.enum';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';

export const MAX_CHAT_IMAGES = 5;
export const MAX_CHAT_VIDEOS = 2;

/**
 * Trạng thái hội thoại đặt lịch - máy chủ KHÔNG lưu phiên, client gửi lại nguyên bản
 * nhận được ở lượt trước. Thay cho cách cũ là đoán lại mọi thứ bằng regex trên toàn bộ
 * lịch sử chat (kể cả câu của chính trợ lý), vốn làm "email" thành "ngày mai" và nhặt
 * nhầm SĐT từ tin nhắn rất cũ.
 *
 * Mọi thứ ở đây là dữ liệu khách tự khai nên được kiểm lại mỗi lượt: id chi nhánh/dịch
 * vụ/loài phải còn hoạt động, `petId` phải thuộc đúng chủ đang đăng nhập.
 */
export class BookingDraftDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  petId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  petName?: string;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @IsUUID()
  breedId?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  time?: string;

  @IsOptional()
  @IsIn(['morning', 'afternoon'])
  period?: 'morning' | 'afternoon';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerFullName?: string;

  @IsOptional()
  @Matches(/^0\d{9}$/)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  symptoms?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHAT_IMAGES)
  @IsUrl({ require_tld: false }, { each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHAT_VIDEOS)
  @IsUrl({ require_tld: false }, { each: true })
  videoUrls?: string[];

  @IsOptional()
  @IsEnum(PriorityColor)
  priorityColor?: PriorityColor;

  /** Những thông tin trợ lý vừa hỏi - để hiểu câu trả lời cụt như "Milu" hay "cái". */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  awaiting?: string[];

  /** Các giờ trống trợ lý vừa đề xuất, để khách trả lời "1", "2"... */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsDateString({}, { each: true })
  offeredSlots?: string[];
}

export class SendChatMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHAT_IMAGES)
  @IsUrl({ require_tld: false }, { each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHAT_VIDEOS)
  @IsUrl({ require_tld: false }, { each: true })
  videos?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BookingDraftDto)
  draft?: BookingDraftDto;
}
