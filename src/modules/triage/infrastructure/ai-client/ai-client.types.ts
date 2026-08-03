/**
 * Wire contract with veterinary-clinic-ai's internal REST API. Keep this in sync with
 * that service's `app/schemas/triage.py` / `app/schemas/chat.py` - both sides were
 * designed together (see CLAUDE.md "Backend <-> AI service contract").
 */
export interface TriageRequest {
  symptom_text: string;
  photo_urls: string[];
  pet_species?: string;
  pet_age_months?: number;
}

export interface SuspectedDiseaseGroup {
  name: string;
  confidence: number;
}

export interface TriageResponse {
  priority_color: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE';
  suspected_disease_groups: SuspectedDiseaseGroup[];
  extracted_symptom_keywords: string[];
  nlp_confidence: number;
  cv_confidence: number | null;
  overall_confidence: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  session_id?: string;
  message: string;
  history?: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  suggest_booking: boolean;
  session_id: string;
}
