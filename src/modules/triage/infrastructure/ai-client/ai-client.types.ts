
export interface DiagnosisRequest {
  'pet-info': {
    breed: string;
    specie?: string;
    gender: string;
    weight: number;
    age: number;
  };
  symptoms: string[];
  describe?: string;
  images: string[];
  videos?: string[];
}

export interface DiagnosisDisease {
  disease: string;
  disease_name?: string | null;
  prevalence_rate: number;
}

export interface DiagnosisDetailedResponse {
  diseases: DiagnosisDisease[];
  triage_result: {
    color_code: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE';
    reasoning: string;
  };
  compiled: {
    'pet-info'?: Record<string, string>;
    symptoms?: Array<{ symptom: string; intensity: number }>;
    triage_result?: { color_code: string; reasoning: string };
  };
  weight_adjustments?: Array<Record<string, unknown>> | null;
}
