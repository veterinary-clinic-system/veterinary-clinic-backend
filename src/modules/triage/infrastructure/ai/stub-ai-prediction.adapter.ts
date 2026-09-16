import { Injectable, Logger } from '@nestjs/common';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import {
  AiChatInput,
  AiChatResult,
  AiPredictionProvider,
  AiTriageInput,
  AiTriageResult,
} from '@/modules/triage/application/ports/ai-prediction.port';

@Injectable()
export class StubAiPredictionAdapter implements AiPredictionProvider {
  private readonly logger = new Logger(StubAiPredictionAdapter.name);

  triage(input: AiTriageInput): Promise<AiTriageResult> {
    this.logger.debug(`[stub] triage: "${input.symptomText.slice(0, 60)}"`);

    return Promise.resolve({
      priorityColor: PriorityColor.YELLOW,
      suspectedGroups: [{ name: 'Chua xac dinh (stub)', confidence: 0.5 }],
      extractedKeywords: [],
      nlpConfidence: 0.5,
      cvConfidence: input.photoUrls.length > 0 ? 0.5 : null,
      overallConfidence: 0.5,
      raw: { stub: true, symptomText: input.symptomText },
      modelVersion: 'stub-0',
    });
  }

  chat(input: AiChatInput): Promise<AiChatResult> {
    return Promise.resolve({
      reply: 'Day la phan hoi mau tu adapter stub. Bat AI_PROVIDER=http de dung dich vu AI that.',
      suggestBooking: false,
      sessionId: input.sessionId ?? 'stub-session',
    });
  }

  learn(): Promise<void> {
    return Promise.resolve();
  }
}
