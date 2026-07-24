import { IsIn, IsOptional, IsString } from 'class-validator';

class ChatHistoryEntryDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class SendChatMessageDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  message: string;

  @IsOptional()
  history?: ChatHistoryEntryDto[];
}
