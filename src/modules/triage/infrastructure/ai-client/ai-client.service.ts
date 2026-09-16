import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import {
  AiDiseaseCatalogItem,
  AiSymptomCatalogItem,
  DiagnosisDetailedResponse,
  DiagnosisRequest,
} from './ai-client.types';

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private symptomLabelsCache: { expiresAt: number; labels: Map<string, string> } | null = null;
  private diseaseCodesCache: { expiresAt: number; codes: Map<string, string> } | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async diagnose(request: DiagnosisRequest): Promise<DiagnosisDetailedResponse> {
    return this.post<DiagnosisDetailedResponse>('/api/v1/diagnose/detailed', request);
  }

  async getSymptomLabels(): Promise<Map<string, string>> {
    if (this.symptomLabelsCache && this.symptomLabelsCache.expiresAt > Date.now()) {
      return this.symptomLabelsCache.labels;
    }
    const symptoms = await this.get<AiSymptomCatalogItem[]>('/api/v1/symptoms');
    const labels = new Map(symptoms.map((item) => [item.symptom_id, item.symptom_name]));
    this.symptomLabelsCache = { expiresAt: Date.now() + 10 * 60_000, labels };
    return labels;
  }

  async getDiseaseCodes(): Promise<Map<string, string>> {
    if (this.diseaseCodesCache && this.diseaseCodesCache.expiresAt > Date.now()) {
      return this.diseaseCodesCache.codes;
    }
    const diseases = await this.get<AiDiseaseCatalogItem[]>('/api/v1/diseases');
    const codes = new Map(
      diseases.map((item) => [normalizeCatalogName(item.disease_name), item.disease_id]),
    );
    this.diseaseCodesCache = { expiresAt: Date.now() + 10 * 60_000, codes };
    return codes;
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('get', path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('post', path, body);
  }

  private async request<T>(method: 'get' | 'post', path: string, body?: unknown): Promise<T> {
    const baseUrl = this.configService.get<string>('aiService.baseUrl')!.replace(/\/$/, '');
    const token = this.configService.get<string>('aiService.token');
    const timeout = this.configService.get<number>('aiService.timeoutMs');

    try {
      const response = await firstValueFrom(
        this.httpService.request<T>({
          method,
          url: `${baseUrl}${path}`,
          data: body,
          timeout,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `veterinary-clinic-ai call to ${path} failed: ${axiosError.response?.status ?? 'network'} ${axiosError.message}`,
      );
      throw new ServiceUnavailableException('The AI pre-screening service is unavailable');
    }
  }
}

function normalizeCatalogName(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN');
}
