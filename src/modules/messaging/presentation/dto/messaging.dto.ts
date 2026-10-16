import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MESSAGE_PAGE_MAX } from '@/modules/messaging/application';

export class OpenConversationDto {
  @ApiPropertyOptional({ description: 'Chủ nuôi: bác sĩ muốn nhắn (doctors.id)' })
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Bác sĩ: chủ nuôi muốn nhắn (users.id)' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class SendMessageDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiPropertyOptional({
    description: 'URL ảnh đã tải lên qua POST /files/upload?category=chat-images',
  })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxLength(1000)
  imageUrl?: string;
}

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ description: 'Lấy các tin cũ hơn mốc này (ISO)' })
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({ default: 30, maximum: MESSAGE_PAGE_MAX })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGE_PAGE_MAX)
  limit?: number;
}
