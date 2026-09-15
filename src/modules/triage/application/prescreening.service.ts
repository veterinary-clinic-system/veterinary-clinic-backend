import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Disease } from '@/modules/catalog/domain/entities/disease.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { PreScreeningResult } from '@/modules/triage/domain/entities/pre-screening-result.entity';
import {
  AI_PREDICTION_PROVIDER,
  AiPredictionProvider,
} from '@/modules/triage/application/ports/ai-prediction.port';

@Injectable()
export class PrescreeningService {
  private readonly logger = new Logger(PrescreeningService.name);

  constructor(
    @InjectRepository(PreScreeningResult)
    private readonly resultsRepository: Repository<PreScreeningResult>,
    @InjectRepository(Disease)
    private readonly diseasesRepository: Repository<Disease>,
    @InjectRepository(Appointment)
    private readonly appointmentsRepository: Repository<Appointment>,
    @Inject(AI_PREDICTION_PROVIDER)
    private readonly aiProvider: AiPredictionProvider,
  ) {}

  async runForAppointment(appointment: Appointment, pet: Pet): Promise<PreScreeningResult> {
    const symptomText = [appointment.commonSymptoms.join(', '), appointment.otherSymptoms ?? '']
      .filter(Boolean)
      .join('. ');

    const aiResult = await this.aiProvider.triage({
      symptomText,
      photoUrls: appointment.photoUrls,
      petSpecies: pet.breed?.species?.speciesName,
    });

    const diseaseGroups = await Promise.all(
      aiResult.suspectedGroups.map((group) => this.findOrCreateDisease(group.name)),
    );

    const existing = await this.resultsRepository.findOne({
      where: { appointmentId: appointment.id },
    });

    const result = this.resultsRepository.create({
      ...(existing ? { id: existing.id } : {}),
      appointmentId: appointment.id,
      symptomText,
      aiSuspectedDiseaseGroups: diseaseGroups,
      aiPriorityColor: aiResult.priorityColor,
      extractedSymptomKeywords: aiResult.extractedKeywords,
      nlpConfidence: aiResult.nlpConfidence,
      cvConfidence: aiResult.cvConfidence,
      overallConfidence: aiResult.overallConfidence,
      modelVersion: aiResult.modelVersion,
      rawAiResponse: aiResult.raw,
    });
    const saved = await this.resultsRepository.save(result);

    await this.appointmentsRepository.update(appointment.id, {
      priorityColor: saved.aiPriorityColor,
    });

    return saved;
  }

  async runForAppointmentSafely(appointment: Appointment, pet: Pet): Promise<void> {
    try {
      await this.runForAppointment(appointment, pet);
    } catch (error) {
      this.logger.warn(
        `Pre-screening skipped for appointment ${appointment.id}: ${(error as Error).message}`,
      );
    }
  }

  async findByAppointment(appointmentId: string): Promise<PreScreeningResult> {
    const result = await this.resultsRepository.findOne({
      where: { appointmentId },
      relations: ['aiSuspectedDiseaseGroups'],
    });
    if (!result) {
      throw new NotFoundException('No pre-screening result for this appointment yet');
    }
    return result;
  }

  private async findOrCreateDisease(name: string): Promise<Disease> {
    const trimmed = name.trim();
    const existing = await this.diseasesRepository.findOne({ where: { diseaseName: trimmed } });
    if (existing) {
      return existing;
    }
    return this.diseasesRepository.save(
      this.diseasesRepository.create({ diseaseName: trimmed, commonSymptoms: [] }),
    );
  }
}
