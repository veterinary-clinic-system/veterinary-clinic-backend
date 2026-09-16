import { PriorityColor } from '@/shared/common/enums/priority-color.enum';

export const AI_PREDICTION_PROVIDER = Symbol('AI_PREDICTION_PROVIDER');

export interface AiTriageInput {
  symptomText: string;
  symptomCodes: string[];
  photoUrls: string[];
  videoUrls: string[];
  petSpecies?: string;
  petBreed?: string;
  petGender?: string;
  petWeight?: number;
  petAgeYears?: number;
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

  cvConfidence: number | null;
  overallConfidence: number;

  raw: Record<string, unknown>;

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
  learn(input: AiTriageInput, confirmedDiseaseNames: string[]): Promise<void>;
}
