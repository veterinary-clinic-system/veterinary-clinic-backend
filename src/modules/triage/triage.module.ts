import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Disease } from '@/modules/catalog/domain/entities/disease.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { PreScreeningResult } from '@/modules/triage/domain/entities/pre-screening-result.entity';
import { PrescreeningService } from '@/modules/triage/application/prescreening.service';
import { AI_PREDICTION_PROVIDER } from '@/modules/triage/application/ports/ai-prediction.port';
import { PrescreeningController } from '@/modules/triage/presentation/prescreening.controller';
import { AiChatController } from '@/modules/triage/presentation/ai-chat.controller';
import { AiClientService } from '@/modules/triage/infrastructure/ai-client/ai-client.service';
import { HttpAiPredictionAdapter } from '@/modules/triage/infrastructure/ai/http-ai-prediction.adapter';
import { StubAiPredictionAdapter } from '@/modules/triage/infrastructure/ai/stub-ai-prediction.adapter';

/**
 * Bounded context `triage`. Diem dang chu y ve kien truc: adapter AI duoc chon o day,
 * ngay tai composition root cua module - day la cho DUY NHAT trong ca he thong biet
 * dang chay AI that hay stub. Tang application chi thay port AI_PREDICTION_PROVIDER.
 */
@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([PreScreeningResult, Disease, Appointment])],
  controllers: [PrescreeningController, AiChatController],
  providers: [
    PrescreeningService,
    AiClientService,
    HttpAiPredictionAdapter,
    StubAiPredictionAdapter,
    {
      provide: AI_PREDICTION_PROVIDER,
      inject: [ConfigService, HttpAiPredictionAdapter, StubAiPredictionAdapter],
      useFactory: (
        config: ConfigService,
        http: HttpAiPredictionAdapter,
        stub: StubAiPredictionAdapter,
      ) => (config.get<string>('aiService.provider') === 'stub' ? stub : http),
    },
  ],
  exports: [PrescreeningService, AI_PREDICTION_PROVIDER],
})
export class TriageModule {}
