import { Injectable } from '@nestjs/common';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import {
  AiChatInput,
  AiChatResult,
  AiPredictionProvider,
  AiTriageInput,
  AiTriageResult,
} from '@/modules/triage/application/ports/ai-prediction.port';
import { AiClientService } from '@/modules/triage/infrastructure/ai-client/ai-client.service';

/**
 * Adapter that (moi truong that): goi apps/veterinary-clinic-ai qua HTTP.
 *
 * Toan bo viec doi ten truong snake_case -> camelCase dung o day. Nho vay khi apps/veterinary-clinic-ai
 * doi hinh dang phan hoi (rat de xay ra moi lan retrain / doi kien truc model), chi
 * file nay phai sua - tang application va domain khong biet gi.
 */
@Injectable()
export class HttpAiPredictionAdapter implements AiPredictionProvider {
  constructor(private readonly client: AiClientService) {}

  async triage(input: AiTriageInput): Promise<AiTriageResult> {
    const response = await this.client.triage({
      symptom_text: input.symptomText,
      photo_urls: input.photoUrls,
      pet_species: input.petSpecies,
      pet_age_months: input.petAgeMonths,
    });

    return {
      priorityColor: response.priority_color as PriorityColor,
      suspectedGroups: response.suspected_disease_groups.map((g) => ({
        name: g.name,
        confidence: g.confidence,
      })),
      extractedKeywords: response.extracted_symptom_keywords,
      nlpConfidence: response.nlp_confidence,
      cvConfidence: response.cv_confidence,
      overallConfidence: response.overall_confidence,
      raw: response as unknown as Record<string, unknown>,
      // apps/veterinary-clinic-ai chua tra ve model_version; mac dinh 'unknown' de ban ghi van hop le,
      // se thay bang gia tri that khi apps/veterinary-clinic-ai bo sung truong nay vao phan hoi.
      modelVersion: (response as unknown as { model_version?: string }).model_version ?? 'unknown',
    };
  }

  async chat(input: AiChatInput): Promise<AiChatResult> {
    const response = await this.client.chat({
      session_id: input.sessionId,
      message: input.message,
      history: input.history,
    });

    return {
      reply: response.reply,
      suggestBooking: response.suggest_booking,
      sessionId: response.session_id,
    };
  }
}
