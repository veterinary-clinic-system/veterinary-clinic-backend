import { PriorityColor } from '@/shared/common/enums/priority-color.enum';

/**
 * Port `AiPredictionProvider` - Phan III tai lieu kien truc.
 *
 * Ly do trung tuong hoa (khong phai vi "cho dep"): tang application khong duoc phu thuoc
 * vao viec AI dang chay o dau hay tra ve JSON hinh dang nao. Hai adapter cu the:
 *
 *   - HttpAiPredictionAdapter : goi that sang apps/veterinary-clinic-ai qua HTTP (moi truong that)
 *   - StubAiPredictionAdapter : tra ket qua co dinh, khong can model
 *
 * Adapter stub phuc vu dung 2 muc dich neu trong tai lieu: (1) test E2E chay duoc khi
 * khong co model, (2) dien tap kich ban "AI chet nhung he thong van dat lich duoc".
 *
 * Kieu du lieu o day la kieu NGHIEP VU (camelCase, PriorityColor cua he thong), khong
 * phai kieu day dien snake_case cua FastAPI - viec anh xa la trach nhiem cua adapter.
 */

export const AI_PREDICTION_PROVIDER = Symbol('AI_PREDICTION_PROVIDER');

export interface AiTriageInput {
  symptomText: string;
  photoUrls: string[];
  petSpecies?: string;
  petAgeMonths?: number;
}

export interface AiSuspectedGroup {
  name: string;
  confidence: number;
}

export interface AiTriageResult {
  priorityColor: PriorityColor;
  suspectedGroups: AiSuspectedGroup[];
  extractedKeywords: string[];
  nlpConfidence: number;
  /** null khi khong co anh nao duoc gui kem. */
  cvConfidence: number | null;
  overallConfidence: number;
  /** Phan hoi tho, luu nguyen vao JSONB de kiem toan va so sanh giua cac phien ban model. */
  raw: Record<string, unknown>;
  /** Phien ban model tao ra ket qua nay - bat buoc de bao cao do chinh xac co gia tri. */
  modelVersion: string;
}

export interface AiChatInput {
  sessionId?: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AiChatResult {
  reply: string;
  suggestBooking: boolean;
  sessionId: string;
}

export interface AiPredictionProvider {
  triage(input: AiTriageInput): Promise<AiTriageResult>;
  chat(input: AiChatInput): Promise<AiChatResult>;
}
