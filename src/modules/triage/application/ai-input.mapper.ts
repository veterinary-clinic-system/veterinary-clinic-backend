import { CommonSymptom } from '@/shared/common/enums/common-symptom.enum';

const COMMON_SYMPTOM_LABELS: Record<CommonSymptom, string> = {
  [CommonSymptom.SKIN_ALLERGY]: 'dị ứng da, nổi mẩn đỏ hoặc ngứa',
  [CommonSymptom.EAR_INFECTION]: 'viêm tai, tai đỏ, ngứa hoặc có dịch',
  [CommonSymptom.VOMITING]: 'nôn mửa',
  [CommonSymptom.DIARRHEA]: 'tiêu chảy',
  [CommonSymptom.HEMATURIA]: 'nước tiểu có máu',
  [CommonSymptom.LOSS_OF_APPETITE]: 'bỏ ăn hoặc chán ăn',
  [CommonSymptom.WEIGHT_LOSS]: 'sụt cân',
  [CommonSymptom.HYPERACTIVITY]: 'tăng động hoặc kích động bất thường',
};

const COMMON_SYMPTOM_CODES: Partial<Record<CommonSymptom, string[]>> = {
  [CommonSymptom.SKIN_ALLERGY]: ['SY013', 'SY017'],
  [CommonSymptom.EAR_INFECTION]: ['SY014'],
  [CommonSymptom.VOMITING]: ['SY025'],
  [CommonSymptom.DIARRHEA]: ['SY026'],
  [CommonSymptom.HEMATURIA]: ['SY030'],
  [CommonSymptom.LOSS_OF_APPETITE]: ['SY011'],
};

export function commonSymptomCodes(symptoms: CommonSymptom[]): string[] {
  return [...new Set(symptoms.flatMap((symptom) => COMMON_SYMPTOM_CODES[symptom] ?? []))];
}

export function buildClinicalDescription(input: {
  commonSymptoms: CommonSymptom[];
  otherSymptoms?: string | null;
  chronicConditions?: string[];
  allergies?: string[];
  petNotes?: string | null;
  appointmentNotes?: string | null;
}): string {
  const sections: string[] = [];
  if (input.commonSymptoms.length > 0) {
    sections.push(
      `Triệu chứng được chọn: ${input.commonSymptoms.map((item) => COMMON_SYMPTOM_LABELS[item]).join(', ')}`,
    );
  }
  if (input.otherSymptoms?.trim()) {
    sections.push(`Mô tả của chủ nuôi: ${input.otherSymptoms.trim()}`);
  }
  if (input.chronicConditions?.length)
    sections.push(`Bệnh nền: ${input.chronicConditions.join(', ')}`);
  if (input.allergies?.length) sections.push(`Tiền sử dị ứng: ${input.allergies.join(', ')}`);
  if (input.petNotes?.trim()) sections.push(`Ghi chú thú cưng: ${input.petNotes.trim()}`);
  if (input.appointmentNotes?.trim())
    sections.push(`Ghi chú lịch hẹn: ${input.appointmentNotes.trim()}`);
  return sections.join('. ');
}

export function normalizeSpeciesForAi(species?: string, breed?: string): string {
  const source = (species ?? '').trim();
  const normalized = stripVietnamese(source).toUpperCase();
  if (/\b(DOG|CHO|CANINE)\b/.test(normalized)) return 'Chó';
  if (/\b(CAT|MEO|FELINE)\b/.test(normalized)) return 'Mèo';
  if (/\b(RABBIT|THO)\b/.test(normalized)) return 'Thỏ';
  if (/\bHAMSTER\b/.test(normalized)) return 'Hamster';
  return source || breed?.trim() || 'Không xác định';
}

export function normalizeGenderForAi(gender?: string): string {
  const normalized = (gender ?? '').trim().toUpperCase();
  if (normalized === 'MALE' || normalized === 'M') return 'M';
  if (normalized === 'FEMALE' || normalized === 'F') return 'F';
  return 'Không xác định';
}

export function validAiImageUrls(urls: string[]): string[] {
  return [...new Set(urls)]
    .map((url) => url.trim())
    .filter((url) => /^(https?:\/\/|data:image\/)/i.test(url))
    .filter((url) => !/\.svg(?:\?|$)/i.test(url))
    .slice(0, 5);
}

export function validAiVideoUrls(urls: string[]): string[] {
  return [...new Set(urls)]
    .map((url) => url.trim())
    .filter((url) => /^https:\/\/res\.cloudinary\.com\//i.test(url))
    .filter((url) => /\.(?:mp4|mov|webm)(?:\?|$)/i.test(url))
    .slice(0, 2);
}

function stripVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd');
}
