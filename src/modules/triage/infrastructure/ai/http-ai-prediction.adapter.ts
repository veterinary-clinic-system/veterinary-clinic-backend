import { randomUUID } from 'crypto';
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
import {
  DiagnosisDetailedResponse,
  DiagnosisRequest,
} from '@/modules/triage/infrastructure/ai-client/ai-client.types';
import {
  normalizeGenderForAi,
  normalizeSpeciesForAi,
  validAiImageUrls,
  validAiVideoUrls,
} from '@/modules/triage/application/ai-input.mapper';

const PRIORITY_LABEL: Record<PriorityColor, string> = {
  [PriorityColor.RED]: 'Cấp cứu ngay',
  [PriorityColor.ORANGE]: 'Khẩn cấp',
  [PriorityColor.YELLOW]: 'Nên khám trong ngày',
  [PriorityColor.GREEN]: 'Ít khẩn cấp',
  [PriorityColor.BLUE]: 'Theo dõi và chăm sóc thông thường',
};

@Injectable()
export class HttpAiPredictionAdapter implements AiPredictionProvider {
  constructor(private readonly client: AiClientService) {}

  async triage(input: AiTriageInput): Promise<AiTriageResult> {
    const response = await this.client.diagnose(this.buildTriageRequest(input));

    return this.toTriageResult(response, await this.loadSymptomLabels());
  }

  async learn(input: AiTriageInput, confirmedDiseaseNames: string[]): Promise<void> {
    const diseaseCodes = await this.client.getDiseaseCodes();
    const confirmedCodes = [
      ...new Set(
        confirmedDiseaseNames
          .map((name) => diseaseCodes.get(normalizeCatalogName(name)))
          .filter((code): code is string => !!code),
      ),
    ];
    if (confirmedCodes.length === 0) return;
    await this.client.diagnose({
      ...this.buildTriageRequest(input),
      diseases: confirmedCodes,
    });
  }

  private buildTriageRequest(input: AiTriageInput): DiagnosisRequest {
    return {
      'pet-info': {
        breed: normalizeSpeciesForAi(input.petSpecies, input.petBreed),
        specie: input.petBreed,
        gender: normalizeGenderForAi(input.petGender),
        weight: input.petWeight ?? null,
        age: input.petAgeYears ?? null,
      },
      symptoms: input.symptomCodes,
      describe: input.symptomText,
      images: validAiImageUrls(input.photoUrls),
      videos: validAiVideoUrls(input.videoUrls),
    };
  }

  async chat(input: AiChatInput): Promise<AiChatResult> {
    const userContext = [
      ...(input.history ?? []),
      { role: 'user' as const, content: input.message },
    ]
      .filter((entry) => entry.role === 'user')
      .slice(-6)
      .map((entry) => entry.content)
      .join('\n');
    const pet = extractPetContext(userContext);
    const response = await this.client.diagnose({
      'pet-info': {
        breed: normalizeSpeciesForAi(pet.species, pet.breed),
        specie: pet.breed,
        gender: normalizeGenderForAi(pet.gender),
        weight: pet.weight ?? null,
        age: pet.ageYears ?? null,
      },
      symptoms: [],
      describe: userContext,
      images: [],
      videos: [],
    });

    return {
      reply: buildChatReply(response),
      suggestBooking: response.triage_result.color_code !== PriorityColor.BLUE,
      sessionId: input.sessionId ?? randomUUID(),
    };
  }

  private toTriageResult(
    response: DiagnosisDetailedResponse,
    symptomLabels: Map<string, string>,
  ): AiTriageResult {
    const priorityColor = response.triage_result.color_code as PriorityColor;
    const topConfidence = response.diseases[0]?.prevalence_rate ?? 0;
    return {
      priorityColor,
      suspectedGroups: response.diseases.map((item) => ({
        name: item.disease_name?.trim() || item.disease,
        confidence: item.prevalence_rate,
      })),
      extractedKeywords: (response.compiled.symptoms ?? []).map((item) => {
        const label = symptomLabels.get(item.symptom);
        return `${label ? `${label} (${item.symptom})` : item.symptom} - mức ${item.intensity}/3`;
      }),
      nlpConfidence: topConfidence,
      cvConfidence: null,
      overallConfidence: topConfidence,
      raw: response as unknown as Record<string, unknown>,
      modelVersion: 'deepseek-v4.1-flash+symptom-matrix-v2',
    };
  }

  private async loadSymptomLabels(): Promise<Map<string, string>> {
    try {
      return await this.client.getSymptomLabels();
    } catch {
      return new Map();
    }
  }
}

function extractPetContext(text: string): {
  species?: string;
  breed?: string;
  gender?: string;
  weight?: number;
  ageYears?: number;
} {
  const normalized = text.toLocaleLowerCase('vi-VN');
  const species = normalized.includes('mèo')
    ? 'Mèo'
    : normalized.includes('chó')
      ? 'Chó'
      : normalized.includes('thỏ')
        ? 'Thỏ'
        : normalized.includes('hamster')
          ? 'Hamster'
          : undefined;
  const breedMatch = text.match(/(?:chó|mèo|thỏ)\s+([\p{L}-]+(?:\s+[\p{L}-]+)?)/iu);
  const weightMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*kg\b/u);
  const yearMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:tuổi|năm)\b/u);
  const monthMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*tháng\b/u);

  return {
    species,
    breed: breedMatch?.[1]?.trim(),
    gender: /\b(?:đực|male)\b/u.test(normalized)
      ? 'MALE'
      : /\b(?:cái|female)\b/u.test(normalized)
        ? 'FEMALE'
        : undefined,
    weight: weightMatch ? Number(weightMatch[1].replace(',', '.')) : undefined,
    ageYears: yearMatch
      ? Number(yearMatch[1].replace(',', '.'))
      : monthMatch
        ? Number(monthMatch[1].replace(',', '.')) / 12
        : undefined,
  };
}

function normalizeCatalogName(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN');
}

function buildChatReply(response: DiagnosisDetailedResponse): string {
  const color = response.triage_result.color_code as PriorityColor;
  const diseaseLines = response.diseases.slice(0, 3).map((item, index) => {
    const name = item.disease_name?.trim() || item.disease;
    return `${index + 1}. ${name} (${Math.round(item.prevalence_rate * 100)}%)`;
  });
  const possibleDiseases = diseaseLines.length
    ? `\n\nCác khả năng tham khảo từ mô hình:\n${diseaseLines.join('\n')}`
    : '';

  return (
    `Mức độ ưu tiên: ${PRIORITY_LABEL[color]}.\n${response.triage_result.reasoning}` +
    possibleDiseases +
    '\n\nĐây là sàng lọc ban đầu, không thay thế chẩn đoán của bác sĩ thú y. Nếu tình trạng xấu đi, hãy đưa bé đi khám ngay.'
  );
}
