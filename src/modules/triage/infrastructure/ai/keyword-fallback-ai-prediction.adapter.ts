import { Logger } from '@nestjs/common';
import {
  AiChatInput,
  AiChatResult,
  AiPetCareAnswer,
  AiPetCareQuestionInput,
  AiPredictionProvider,
  AiTriageInput,
  AiTriageResult,
} from '@/modules/triage/application/ports/ai-prediction.port';
import { keywordTriage } from '@/modules/triage/application/keyword-triage';

/**
 * Bọc dịch vụ AI thật: khi `triage` lỗi (hết hạn khoá, mô hình quá tải, mất mạng...) thì
 * phân loại theo từ khoá thay vì ném lỗi - chat vẫn trả lời được và lịch hẹn vẫn có
 * `priorityColor`. Các thao tác khác giữ nguyên lỗi: `learn` không được học từ kết quả dự
 * phòng, và hỏi đáp chung đã có câu trả lời cố định ở phía trợ lý.
 */
export class KeywordFallbackAiPredictionAdapter implements AiPredictionProvider {
  private readonly logger = new Logger(KeywordFallbackAiPredictionAdapter.name);

  constructor(private readonly primary: AiPredictionProvider) {}

  async triage(input: AiTriageInput): Promise<AiTriageResult> {
    try {
      return await this.primary.triage(input);
    } catch (error) {
      // Chỉ có ảnh/video mà không có chữ: luật từ khoá không có gì để đọc, đoán GREEN
      // sẽ trấn an sai - để người gọi xử lý như "chưa phân loại".
      if (!input.symptomText.trim()) throw error;
      this.logger.warn(
        `AI triage lỗi, chuyển sang phân loại theo từ khoá: ${(error as Error).message}`,
      );
      return keywordTriage(input.symptomText);
    }
  }

  chat(input: AiChatInput): Promise<AiChatResult> {
    return this.primary.chat(input);
  }

  answerPetCareQuestion(input: AiPetCareQuestionInput): Promise<AiPetCareAnswer> {
    return this.primary.answerPetCareQuestion(input);
  }

  learn(input: AiTriageInput, confirmedDiseaseNames: string[]): Promise<void> {
    return this.primary.learn(input, confirmedDiseaseNames);
  }
}
