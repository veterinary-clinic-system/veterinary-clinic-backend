import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment, Disease, PreScreeningResult } from '@/database/entities';
import { PrescreeningService } from './prescreening.service';
import { PrescreeningController } from './prescreening.controller';
import { AiChatController } from './ai-chat.controller';
import { AiClientService } from './ai-client/ai-client.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([PreScreeningResult, Disease, Appointment]),
  ],
  controllers: [PrescreeningController, AiChatController],
  providers: [PrescreeningService, AiClientService],
  exports: [PrescreeningService, AiClientService],
})
export class PrescreeningModule {}
